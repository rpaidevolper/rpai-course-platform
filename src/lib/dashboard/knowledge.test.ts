import { describe, expect, it } from "vitest";
import type { KnowledgeStore } from "@/lib/knowledge/store";
import { CLIENT_NAME_FLAG, type KnowledgeDocument } from "@/lib/knowledge/types";
import { parseBrowseFilter, readKnowledgeDocument } from "./knowledge";

function doc(id: string, overrides: Partial<KnowledgeDocument> = {}): KnowledgeDocument {
  return {
    id,
    kind: "unit_card",
    modules: ["A1"],
    title: "單元卡",
    frontmatter: {},
    body: "內文",
    flags: [],
    retired_at: null,
    synced_at: "2026-10-26T00:00:00.000Z",
    ...overrides,
  };
}

/** 記憶體裡的 KnowledgeStore，記下 get 被問過哪些 id（和資料庫一樣，get 找得到任何一份）。 */
function memoryStore(docs: KnowledgeDocument[]) {
  const asked: string[] = [];
  const store: KnowledgeStore = {
    async list() {
      return docs.filter((d) => !d.retired_at);
    },
    async get(id) {
      asked.push(id);
      return docs.find((d) => d.id === id) ?? null;
    },
  };
  return { store, asked };
}

const AVAILABLE = "00000000-0000-4000-8000-000000000001";
const PAUSED = "00000000-0000-4000-8000-000000000002";
const RETIRED = "00000000-0000-4000-8000-000000000003";
const MISSING = "00000000-0000-4000-8000-000000000009";

describe("readKnowledgeDocument 單篇頁讀一份文件", () => {
  const docs = [
    doc(AVAILABLE, { title: "可用的卡" }),
    doc(PAUSED, { flags: [CLIENT_NAME_FLAG] }),
    doc(RETIRED, { retired_at: "2026-10-25T00:00:00.000Z" }),
  ];

  it("AI 查得到的文件回完整內容", async () => {
    const { store } = memoryStore(docs);
    await expect(readKnowledgeDocument(store, AVAILABLE)).resolves.toMatchObject({ id: AVAILABLE, title: "可用的卡" });
  });

  it("暫停使用、退役、找不到的都回 null（頁面據此回 404）", async () => {
    const { store } = memoryStore(docs);
    await expect(readKnowledgeDocument(store, PAUSED)).resolves.toBeNull();
    await expect(readKnowledgeDocument(store, RETIRED)).resolves.toBeNull();
    await expect(readKnowledgeDocument(store, MISSING)).resolves.toBeNull();
  });

  it("不是 uuid 的 id 直接回 null，不送查詢", async () => {
    const { store, asked } = memoryStore(docs);
    await expect(readKnowledgeDocument(store, "not-a-uuid")).resolves.toBeNull();
    await expect(readKnowledgeDocument(store, "1 or 1=1")).resolves.toBeNull();
    expect(asked).toEqual([]);
  });
});

describe("parseBrowseFilter 網址參數轉成知識庫篩選", () => {
  it("合法的種類、模組與關鍵字都帶進篩選；關鍵字去掉前後空白", () => {
    expect(parseBrowseFilter({ kind: "unit_card", module: "A4", q: "  GAS 觸發器 " })).toEqual({
      kind: "unit_card",
      module: "A4",
      query: "GAS 觸發器",
    });
  });

  it("不認得的種類與模組、空白的關鍵字都當作沒篩選", () => {
    expect(parseBrowseFilter({ kind: "proposal", module: "C9", q: "   " })).toEqual({});
    expect(parseBrowseFilter({})).toEqual({});
  });

  it("同一個參數出現多次只取第一個；關鍵字最多 100 字", () => {
    expect(parseBrowseFilter({ kind: ["recipe", "unit_card"], q: "字".repeat(150) })).toEqual({
      kind: "recipe",
      query: "字".repeat(100),
    });
  });
});
