import { describe, expect, it } from "vitest";
import { FIXTURE_CLIENT_NAMES, loadFixture } from "./fixtures/load.ts";
import { createMemorySyncStore, type MemorySyncStore } from "./store.ts";
import { runSync } from "./sync.ts";
import { planSync } from "./sync-plan.ts";
import type { KnowledgeDocumentInput, MarkdownFile } from "./types.ts";

const NOW = new Date("2026-10-25T08:00:00.000Z");
const LATER = new Date("2026-10-26T08:00:00.000Z");

async function syncOnce(
  store: MemorySyncStore,
  files: MarkdownFile[],
  options: { apply: boolean; aliasesText?: string | null; now?: Date },
) {
  const logs: string[] = [];
  const result = await runSync({
    files,
    aliasesText: options.aliasesText ?? null,
    apply: options.apply,
    store,
    now: options.now ?? NOW,
    log: (line) => logs.push(line),
  });
  return { result, logs };
}

async function fixtureFiles(): Promise<MarkdownFile[]> {
  return (await loadFixture()).files;
}

async function fixtureAliases(): Promise<string> {
  return (await loadFixture()).aliasesText;
}

describe("runSync 同步", () => {
  it("第一次 apply：全部新增", async () => {
    const store = createMemorySyncStore();
    const { result, logs } = await syncOnce(store, await fixtureFiles(), {
      apply: true,
      aliasesText: await fixtureAliases(),
    });
    expect(result).toMatchObject({ ok: true, written: true });
    expect(result.plan?.inserts).toHaveLength(11);
    expect(store.rows()).toHaveLength(11);
    expect(store.writeCalls()).toBe(1);
    expect(logs[0]).toBe("知識庫同步（已寫入）");
    expect(logs).toContain("與平台比對：新增 11、更新 0、不變 0、退役 0");
  });

  it("同一份資料夾重跑：全部不變，沒有任何寫入", async () => {
    const store = createMemorySyncStore();
    const files = await fixtureFiles();
    const aliasesText = await fixtureAliases();
    await syncOnce(store, files, { apply: true, aliasesText });
    const writesBefore = store.writeCalls();

    const { result } = await syncOnce(store, files, { apply: true, aliasesText, now: LATER });
    expect(result.plan).toMatchObject({ inserts: [], updates: [], retirements: [] });
    expect(result.plan?.unchanged).toHaveLength(11);
    expect(store.writeCalls()).toBe(writesBefore);
    expect(store.rows().every((row) => row.synced_at === NOW.toISOString())).toBe(true);
  });

  it("拿掉一個檔案再跑：那份退役；放回來再跑：更新並清掉退役", async () => {
    const store = createMemorySyncStore();
    const files = await fixtureFiles();
    const aliasesText = await fixtureAliases();
    await syncOnce(store, files, { apply: true, aliasesText });
    const b1Path = "單元卡/B1_流程診斷練習.md";
    const withoutB1 = files.filter((file) => file.path !== b1Path);

    const removed = await syncOnce(store, withoutB1, { apply: true, aliasesText, now: LATER });
    expect(removed.result.plan?.retirements).toHaveLength(1);
    const retired = store.rows().filter((row) => row.retired_at !== null);
    expect(retired.map((row) => row.title)).toEqual(["流程診斷練習"]);
    expect(retired[0].retired_at).toBe(LATER.toISOString());

    const restored = await syncOnce(store, files, { apply: true, aliasesText, now: LATER });
    expect(restored.result.plan?.updates).toHaveLength(1);
    expect(restored.result.plan?.updates[0].doc.title).toBe("流程診斷練習");
    expect(store.rows().filter((row) => row.retired_at !== null)).toHaveLength(0);
  });

  it("內容改了：更新，雜湊跟著變", async () => {
    const store = createMemorySyncStore();
    const files = await fixtureFiles();
    const aliasesText = await fixtureAliases();
    await syncOnce(store, files, { apply: true, aliasesText });
    const edited = files.map((file) =>
      file.path === "單元卡/A4_雲端表單自動化.md" ? { ...file, text: file.text.replace("一條可以運作", "兩條可以運作") } : file,
    );

    const { result } = await syncOnce(store, edited, { apply: true, aliasesText, now: LATER });
    expect(result.plan?.updates).toHaveLength(1);
    expect(result.plan?.unchanged).toHaveLength(10);
  });

  it("apply 是 false：只出報告，store 完全沒有被寫入", async () => {
    const store = createMemorySyncStore();
    const { result, logs } = await syncOnce(store, await fixtureFiles(), {
      apply: false,
      aliasesText: await fixtureAliases(),
    });
    expect(result).toMatchObject({ ok: true, written: false });
    expect(result.plan?.inserts).toHaveLength(11);
    expect(store.writeCalls()).toBe(0);
    expect(store.rows()).toHaveLength(0);
    expect(logs[0]).toBe("知識庫同步（試跑，沒有寫入；加 --apply 才會寫入）");
  });

  it("報告列出帶旗標的檔案（遮過的路徑），內容與數量正確", async () => {
    const { logs } = await syncOnce(createMemorySyncStore(), await fixtureFiles(), {
      apply: false,
      aliasesText: await fixtureAliases(),
    });
    expect(logs).toContain("讀到 13 個 Markdown：模組框架 1、模組卡 2、單元卡 4、課程配方 4；略過 2 個（不是知識庫文件）");
    expect(logs).toContain("名稱表：6 個名稱（配方 3、別名檔 3）。報告不列出名稱。");
    expect(logs).toContain("暫停使用：3 份文字含客戶名稱，AI 查不到，修正資料夾後重跑。");
    expect(logs).toContain("  - 單元卡/A2_資料整理實作.md");
    expect(logs).toContain("  - 模組卡/B2_提問與指令.md");
  });

  it("報告的任何一行都不含名稱表裡的名稱", async () => {
    const { logs } = await syncOnce(createMemorySyncStore(), await fixtureFiles(), {
      apply: false,
      aliasesText: await fixtureAliases(),
    });
    const report = logs.join("\n").toLowerCase();
    for (const name of FIXTURE_CLIENT_NAMES) {
      expect(report, `報告不應含有 ${name}`).not.toContain(name.toLowerCase());
    }
  });

  it("硬錯誤：不寫入，回傳失敗，印出錯誤", async () => {
    const store = createMemorySyncStore();
    const files = (await fixtureFiles()).filter((file) => file.path !== "模組框架.md");
    const { result, logs } = await syncOnce(store, files, { apply: true, aliasesText: await fixtureAliases() });
    expect(result).toMatchObject({ ok: false, written: false, plan: null });
    expect(store.writeCalls()).toBe(0);
    expect(logs[0]).toContain("硬錯誤");
    expect(logs).toContain("  - 找不到模組框架：資料夾裡要有一份 frontmatter 含 version 與 always_load 的文件");
  });

  it("硬錯誤（module 不合法、id 重複、frontmatter 無法解析）時也不寫入", async () => {
    const cases: MarkdownFile[][] = [
      [{ path: "模組框架.md", text: "---\nid: framework\nversion: 2026\nalways_load: true\n---\n" }, { path: "單元卡/x.md", text: "---\nid: x\nmodule: A9\nminutes: 60\n---\n" }],
      [{ path: "模組框架.md", text: "---\nid: framework\nversion: 2026\nalways_load: true\n---\n" }, { path: "單元卡/x.md", text: "---\nid: dup\nmodule: A1\nminutes: 60\n---\n" }, { path: "單元卡/y.md", text: "---\nid: dup\nmodule: A1\nminutes: 60\n---\n" }],
      [{ path: "模組框架.md", text: "---\nid: framework\nversion: 2026\nalways_load: true\n---\n" }, { path: "單元卡/z.md", text: "---\nid: z\nmodule: A1\nminutes: 60\n--- 壞\nx\n" }],
    ];
    for (const files of cases) {
      const store = createMemorySyncStore();
      const { result } = await syncOnce(store, files, { apply: true });
      expect(result.ok).toBe(false);
      expect(store.writeCalls()).toBe(0);
    }
  });
});

describe("planSync 比對計畫", () => {
  const doc = (source_key: string, content_hash: string): KnowledgeDocumentInput => ({
    kind: "unit_card",
    source_key,
    modules: ["A1"],
    title: source_key,
    frontmatter: {},
    body: "",
    content_hash,
    flags: [],
    path: `${source_key}.md`,
  });

  it("新的新增、一樣的不變、雜湊不同的更新、平台有而這次沒有的退役", () => {
    const plan = planSync(
      [doc("new", "h1"), doc("same", "h2"), doc("changed", "h3")],
      [
        { id: "id-same", source_key: "same", content_hash: "h2", retired_at: null },
        { id: "id-changed", source_key: "changed", content_hash: "old", retired_at: null },
        { id: "id-gone", source_key: "gone", content_hash: "h4", retired_at: null },
      ],
    );
    expect(plan.inserts.map((d) => d.source_key)).toEqual(["new"]);
    expect(plan.unchanged).toEqual(["id-same"]);
    expect(plan.updates.map((u) => [u.id, u.doc.source_key])).toEqual([["id-changed", "changed"]]);
    expect(plan.retirements).toEqual(["id-gone"]);
  });

  it("已經退役的：又出現就更新（清掉退役），沒有出現就不再處理", () => {
    const plan = planSync(
      [doc("back", "h1")],
      [
        { id: "id-back", source_key: "back", content_hash: "h1", retired_at: "2026-10-01T00:00:00.000Z" },
        { id: "id-old", source_key: "old", content_hash: "h2", retired_at: "2026-10-01T00:00:00.000Z" },
      ],
    );
    expect(plan.updates.map((u) => u.id)).toEqual(["id-back"]);
    expect(plan.retirements).toEqual([]);
  });
});
