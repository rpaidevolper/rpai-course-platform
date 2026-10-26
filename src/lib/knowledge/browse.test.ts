import { describe, expect, it } from "vitest";
import { browseKnowledge } from "./browse.ts";
import { buildKnowledgeDocuments } from "./documents.ts";
import { FIXTURE_CLIENT_NAMES, loadFixture } from "./fixtures/load.ts";
import { CLIENT_NAME_FLAG, type KnowledgeDocument } from "./types.ts";

let nextId = 0;
function doc(overrides: Partial<KnowledgeDocument>): KnowledgeDocument {
  nextId++;
  return {
    id: `00000000-0000-4000-8000-${String(nextId).padStart(12, "0")}`,
    kind: "unit_card",
    modules: ["A1"],
    title: "Untitled",
    frontmatter: {},
    body: "內文",
    flags: [],
    retired_at: null,
    synced_at: "2026-10-26T00:00:00.000Z",
    ...overrides,
  };
}

describe("browseKnowledge 網頁的知識庫列表", () => {
  it("依種類分組（框架、模組卡、單元卡、配方），組內依標題排序；沒有文件的種類不出現", () => {
    const docs = [
      doc({ kind: "recipe", title: "製造・A3・一日" }),
      doc({ kind: "unit_card", title: "Beta" }),
      doc({ kind: "framework", title: "模組框架" }),
      doc({ kind: "unit_card", title: "Alpha" }),
    ];

    const result = browseKnowledge(docs, {});

    expect(result.groups.map((g) => [g.label, g.items.map((item) => item.title)])).toEqual([
      ["模組框架", ["模組框架"]],
      ["單元卡", ["Alpha", "Beta"]],
      ["課程配方", ["製造・A3・一日"]],
    ]);
  });

  it("暫停使用與退役的文件不列出；暫停使用的只計數量，退役的不算", () => {
    const docs = [
      doc({ kind: "unit_card", title: "可用的卡" }),
      doc({ kind: "unit_card", title: "含客戶名稱的卡", flags: [CLIENT_NAME_FLAG] }),
      doc({ kind: "recipe", title: "含客戶名稱的配方", flags: [CLIENT_NAME_FLAG] }),
      doc({ kind: "unit_card", title: "退役的卡", retired_at: "2026-10-25T00:00:00.000Z" }),
    ];

    const result = browseKnowledge(docs, {});

    expect(result.groups.flatMap((g) => g.items.map((item) => item.title))).toEqual(["可用的卡"]);
    expect(result.counts).toEqual({
      framework: { available: 0, paused: 0 },
      module_card: { available: 0, paused: 0 },
      unit_card: { available: 1, paused: 1 },
      recipe: { available: 0, paused: 1 },
    });
  });

  it("種類、模組、關鍵字篩選都有效；份數統計不受篩選影響", () => {
    const docs = [
      doc({ kind: "unit_card", modules: ["A4"], title: "GAS 入門", body: "觸發器" }),
      doc({ kind: "unit_card", modules: ["A5"], title: "Claude Code 入門", body: "觸發器" }),
      doc({ kind: "module_card", modules: ["A4"], title: "A4 雲端自動化", body: "GAS" }),
    ];

    const titles = (filter: Parameters<typeof browseKnowledge>[1]) =>
      browseKnowledge(docs, filter).groups.flatMap((g) => g.items.map((item) => item.title));

    expect(titles({ kind: "unit_card" })).toEqual(["Claude Code 入門", "GAS 入門"]);
    expect(titles({ module: "A4" })).toEqual(["A4 雲端自動化", "GAS 入門"]);
    expect(titles({ query: "gas" })).toEqual(["A4 雲端自動化", "GAS 入門"]);
    expect(titles({ kind: "unit_card", module: "A4", query: "觸發器" })).toEqual(["GAS 入門"]);
    expect(browseKnowledge(docs, { kind: "module_card" }).counts.unit_card).toEqual({ available: 2, paused: 0 });
  });

  it("沒有 MCP 的 50 筆上限：同一個模組有 60 張單元卡，全部列出", () => {
    const docs = Array.from({ length: 60 }, (_, i) =>
      doc({ kind: "unit_card", modules: ["A4"], title: `單元 ${String(i).padStart(2, "0")}` }),
    );

    const [group] = browseKnowledge(docs, { module: "A4" }).groups;

    expect(group.items).toHaveLength(60);
  });

  it("內容最後更新時間是還沒退役的文件裡最新的 synced_at（暫停使用的也算；沒變的文件同步時不會更新它）；沒有文件是 null", () => {
    const docs = [
      doc({ synced_at: "2026-10-24T08:00:00.000Z" }),
      doc({ synced_at: "2026-10-26T09:30:00.000Z", flags: [CLIENT_NAME_FLAG] }),
      doc({ synced_at: "2026-10-25T12:00:00.000Z" }),
      doc({ synced_at: "2026-10-27T00:00:00.000Z", retired_at: "2026-10-27T00:00:00.000Z" }),
    ];

    expect(browseKnowledge(docs, {}).lastChangedAt).toBe("2026-10-26T09:30:00.000Z");
    expect(browseKnowledge([], {}).lastChangedAt).toBeNull();
  });

  it("用 fixture 資料夾同步出來的文件：帶旗標的只算份數，列表的標題與摘要裡沒有任何客戶名稱", async () => {
    const { files, aliasesText } = await loadFixture();
    const docs = buildKnowledgeDocuments(files, aliasesText).documents.map((input) =>
      doc({ kind: input.kind, modules: input.modules, title: input.title, frontmatter: input.frontmatter, body: input.body, flags: input.flags }),
    );
    const flagged = docs.filter((d) => d.flags.length > 0).length;
    expect(flagged).toBeGreaterThan(0);

    const result = browseKnowledge(docs, {});

    const paused = Object.values(result.counts).reduce((sum, count) => sum + count.paused, 0);
    expect(paused).toBe(flagged);
    const shown = JSON.stringify(result.groups);
    for (const name of FIXTURE_CLIENT_NAMES) expect(shown).not.toContain(name);
  });
});
