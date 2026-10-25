import { describe, expect, it } from "vitest";
import { buildKnowledgeDocuments } from "@/lib/knowledge/documents";
import { loadFixture } from "@/lib/knowledge/fixtures/load";
import type { KnowledgeFilter, KnowledgeStore } from "@/lib/knowledge/store";
import type { KnowledgeDocument } from "@/lib/knowledge/types";
import { registerKnowledgeTools } from "./knowledge";
import { createTestServer } from "./testing";

const ALICE = "00000000-0000-4000-8000-00000000000a";
const BOB = "00000000-0000-4000-8000-00000000000b";
const RETIRED_AT = "2026-10-25T00:00:00.000Z";

/** 記憶體裡的 KnowledgeStore：和資料庫一樣，list 排除退役；get 找得到任何一份（旗標由工具層擋）。 */
function memoryStore(docs: KnowledgeDocument[]): KnowledgeStore {
  return {
    async list(filter: KnowledgeFilter) {
      return docs.filter(
        (doc) =>
          !doc.retired_at &&
          (!filter.kind || doc.kind === filter.kind) &&
          (!filter.module || doc.modules.includes(filter.module)),
      );
    },
    async get(id) {
      return docs.find((doc) => doc.id === id) ?? null;
    },
  };
}

/** 用 fixture 資料夾建出文件（和同步後平台上的一樣，帶旗標的也在）。 */
async function fixtureDocs(): Promise<KnowledgeDocument[]> {
  const { files, aliasesText } = await loadFixture();
  const built = buildKnowledgeDocuments(files, aliasesText);
  return built.documents.map((doc, i) => ({
    id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
    kind: doc.kind,
    modules: doc.modules,
    title: doc.title,
    frontmatter: doc.frontmatter,
    body: doc.body,
    flags: doc.flags,
    retired_at: null,
  }));
}

function findDoc(docs: KnowledgeDocument[], title: string, kind?: KnowledgeDocument["kind"]): KnowledgeDocument {
  const doc = docs.find((d) => d.title === title && (!kind || d.kind === kind));
  if (!doc) throw new Error(`沒有這份文件：${title}`);
  return doc;
}

function setup(docs: KnowledgeDocument[]) {
  const t = createTestServer();
  registerKnowledgeTools(t.server, memoryStore(docs));
  return t;
}

describe("rpai_platform_search_knowledge", () => {
  it("帶旗標的文件查不到（B2 模組卡的常見搭配含客戶名稱）", async () => {
    const docs = await fixtureDocs();
    const result = await setup(docs).call("rpai_platform_search_knowledge", { query: "提問與指令" }, { ownerId: ALICE });
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent?.documents).not.toContainEqual(expect.objectContaining({ title: "B2 提問與指令" }));
  });

  it("退役的文件查不到", async () => {
    const docs = await fixtureDocs();
    findDoc(docs, "雲端表單自動化").retired_at = RETIRED_AT;
    const result = await setup(docs).call("rpai_platform_search_knowledge", { query: "雲端表單" }, { ownerId: ALICE });
    expect(result.structuredContent).toEqual({ count: 0, documents: [] });
  });

  it("kind 過濾有效：只回模組卡（B2 帶旗標，只剩 A1）", async () => {
    const result = await setup(await fixtureDocs()).call(
      "rpai_platform_search_knowledge",
      { kind: "module_card" },
      { ownerId: ALICE },
    );
    expect(result.structuredContent).toMatchObject({ count: 1, documents: [{ kind: "module_card", title: "A1 通用生成 AI" }] });
  });

  it("module 過濾有效：只回 modules 包含 A1 的文件，而且沒有帶旗標的", async () => {
    const docs = await fixtureDocs();
    const result = await setup(docs).call("rpai_platform_search_knowledge", { module: "A1" }, { ownerId: ALICE });
    const documents = (result.structuredContent?.documents ?? []) as { modules: string[]; title: string }[];
    expect(documents.length).toBeGreaterThan(0);
    for (const doc of documents) expect(doc.modules).toContain("A1");
    expect(documents.map((d) => d.title)).not.toContain("會議紀錄整理");
  });

  it("結果含 id、種類、模組、標題與摘要，不含本文與 frontmatter", async () => {
    const result = await setup(await fixtureDocs()).call(
      "rpai_platform_search_knowledge",
      { kind: "recipe", query: "週報" },
      { ownerId: ALICE },
    );
    const [first] = (result.structuredContent?.documents ?? []) as Record<string, unknown>[];
    expect(Object.keys(first).sort()).toEqual(["id", "kind", "modules", "snippet", "title"]);
    expect(first).toMatchObject({ kind: "recipe", title: "製造・A1、A2、B1・一日" });
  });

  it("全團隊共用：別的講師的權杖也查得到同一份知識", async () => {
    const result = await setup(await fixtureDocs()).call("rpai_platform_search_knowledge", { kind: "framework" }, { ownerId: BOB });
    expect(result.structuredContent).toMatchObject({ count: 1, documents: [{ kind: "framework" }] });
  });

  it("輸入不合格（kind、limit、query 超長）不進 handler，錯誤指出欄位", async () => {
    const t = setup(await fixtureDocs());
    const badKind = await t.call("rpai_platform_search_knowledge", { kind: "book" }, { ownerId: ALICE });
    expect(badKind.isError).toBe(true);
    expect(badKind.content[0].text).toContain("kind");

    const badLimit = await t.call("rpai_platform_search_knowledge", { limit: 51 }, { ownerId: ALICE });
    expect(badLimit.isError).toBe(true);
    expect(badLimit.content[0].text).toContain("limit");

    const longQuery = await t.call("rpai_platform_search_knowledge", { query: "字".repeat(101) }, { ownerId: ALICE });
    expect(longQuery.isError).toBe(true);
    expect(longQuery.content[0].text).toContain("query");
  });
});

describe("rpai_platform_read_knowledge", () => {
  it("回傳完整內容：id、種類、模組、標題、frontmatter 與本文", async () => {
    const docs = await fixtureDocs();
    const recipe = findDoc(docs, "製造・A1、A2、B1・一日", "recipe");
    const result = await setup(docs).call("rpai_platform_read_knowledge", { id: recipe.id }, { ownerId: ALICE });
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toMatchObject({
      id: recipe.id,
      kind: "recipe",
      modules: ["A1", "A2", "B1"],
      title: "製造・A1、A2、B1・一日",
      frontmatter: { industry: "製造", status: "已交付", hours: 6, units: ["A1_會議紀錄整理", "A2_資料整理實作", "B1_流程診斷練習"] },
    });
    expect(String(result.structuredContent?.body)).toContain("## 課程重點");
  });

  it("帶旗標的文件讀不到，回白話說明", async () => {
    const docs = await fixtureDocs();
    const flagged = findDoc(docs, "B2 提問與指令", "module_card");
    const result = await setup(docs).call("rpai_platform_read_knowledge", { id: flagged.id }, { ownerId: ALICE });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("找不到這份知識庫文件，或它已經停用");
  });

  it("退役的文件讀不到", async () => {
    const docs = await fixtureDocs();
    const unit = findDoc(docs, "雲端表單自動化", "unit_card");
    unit.retired_at = RETIRED_AT;
    const result = await setup(docs).call("rpai_platform_read_knowledge", { id: unit.id }, { ownerId: ALICE });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("找不到這份知識庫文件");
  });

  it("沒有這個 id、或 id 不是 uuid", async () => {
    const t = setup(await fixtureDocs());
    const missing = await t.call("rpai_platform_read_knowledge", { id: "00000000-0000-4000-8000-ffffffffffff" }, { ownerId: ALICE });
    expect(missing.isError).toBe(true);
    const notUuid = await t.call("rpai_platform_read_knowledge", { id: "單元卡" }, { ownerId: ALICE });
    expect(notUuid.isError).toBe(true);
    expect(notUuid.content[0].text).toContain("id");
  });
});

describe("兩個工具都是唯讀", () => {
  it.each(["rpai_platform_search_knowledge", "rpai_platform_read_knowledge"])("%s 的 annotations", (name) => {
    const config = setup([]).config(name) as { annotations?: Record<string, unknown> } | undefined;
    expect(config?.annotations).toEqual({
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    });
  });
});
