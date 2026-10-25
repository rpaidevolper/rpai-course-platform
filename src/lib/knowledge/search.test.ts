import { describe, expect, it } from "vitest";
import { isServable, searchKnowledge } from "./search.ts";
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
    ...overrides,
  };
}

describe("isServable 能不能送給 AI", () => {
  it("沒退役、沒旗標才能送", () => {
    expect(isServable(doc({}))).toBe(true);
    expect(isServable(doc({ retired_at: "2026-10-25T00:00:00.000Z" }))).toBe(false);
    expect(isServable(doc({ flags: [CLIENT_NAME_FLAG] }))).toBe(false);
  });
});

describe("searchKnowledge 搜尋", () => {
  it("帶旗標與退役的文件，就算關鍵字命中也查不到", () => {
    const docs = [
      doc({ title: "Meeting notes", body: "逐字稿" }),
      doc({ title: "Meeting notes (flagged)", flags: [CLIENT_NAME_FLAG] }),
      doc({ title: "Meeting notes (retired)", retired_at: "2026-10-25T00:00:00.000Z" }),
    ];
    const hits = searchKnowledge(docs, { query: "meeting" });
    expect(hits.map((h) => h.title)).toEqual(["Meeting notes"]);
  });

  it("kind 與 module 過濾有效；module 比對的是 modules 陣列", () => {
    const docs = [
      doc({ kind: "unit_card", modules: ["A1"], title: "Alpha" }),
      doc({ kind: "unit_card", modules: ["A2", "B1"], title: "Beta" }),
      doc({ kind: "module_card", modules: ["A1"], title: "Gamma" }),
    ];
    expect(searchKnowledge(docs, { kind: "unit_card" }).map((h) => h.title)).toEqual(["Alpha", "Beta"]);
    expect(searchKnowledge(docs, { module: "B1" }).map((h) => h.title)).toEqual(["Beta"]);
    expect(searchKnowledge(docs, { kind: "unit_card", module: "A1" }).map((h) => h.title)).toEqual(["Alpha"]);
  });

  it("有關鍵字：標題命中 3 分、本文命中 1 分，0 分不要，分數高的在前；不分大小寫", () => {
    const docs = [
      doc({ title: "Alpha", body: "這裡提到 Claude 一次" }), // 本文命中 claude：1 分
      doc({ title: "claude notes", body: "沒有別的" }), // 標題命中 claude：3 分
      doc({ title: "Other", body: "none" }), // 0 分，不要
      doc({ title: "Beta", body: "提問與指令" }), // 本文命中 指令：1 分
    ];
    const hits = searchKnowledge(docs, { query: "CLAUDE 指令" });
    // 同分（1 分）時依標題排：Alpha 在 Beta 前
    expect(hits.map((h) => h.title)).toEqual(["claude notes", "Alpha", "Beta"]);
  });

  it("沒有關鍵字：依種類（框架、模組卡、單元卡、配方）再依標題排序", () => {
    const docs = [
      doc({ kind: "recipe", title: "Mu" }),
      doc({ kind: "unit_card", title: "Beta" }),
      doc({ kind: "framework", title: "Zeta" }),
      doc({ kind: "module_card", title: "Omega" }),
      doc({ kind: "unit_card", title: "Alpha" }),
    ];
    expect(searchKnowledge(docs).map((h) => h.title)).toEqual(["Zeta", "Omega", "Alpha", "Beta", "Mu"]);
  });

  it("預設最多 20 筆，最多 50 筆；指定 limit 照做", () => {
    const docs = Array.from({ length: 60 }, (_, i) => doc({ title: `Unit ${String(i).padStart(2, "0")}` }));
    expect(searchKnowledge(docs)).toHaveLength(20);
    expect(searchKnowledge(docs, { limit: 3 })).toHaveLength(3);
    expect(searchKnowledge(docs, { limit: 100 })).toHaveLength(50);
  });

  it("有關鍵字命中本文時，摘要含命中的字，前後截斷時加「…」", () => {
    const body = "開頭很長的一段。".repeat(20) + "這裡才提到關鍵字。" + "結尾很長的一段。".repeat(20);
    const [hit] = searchKnowledge([doc({ title: "標題", body })], { query: "關鍵字" });
    expect(hit.snippet).toContain("關鍵字");
    expect(hit.snippet.startsWith("…")).toBe(true);
    expect(hit.snippet.endsWith("…")).toBe(true);
    expect([...hit.snippet].length).toBeLessThanOrEqual(122);
  });

  it("沒有關鍵字：摘要是本文去掉 # 標題行後的前段，不含標題行", () => {
    const body = "# 大標題\n## 小標題\n第一段內容\n\n第二段內容";
    const [hit] = searchKnowledge([doc({ title: "標題", body })]);
    expect(hit.snippet).toBe("第一段內容 第二段內容");
    expect(hit.snippet).not.toContain("大標題");
  });

  it("結果只含 id、種類、模組、標題與摘要", () => {
    const [hit] = searchKnowledge([doc({ kind: "framework", modules: [], title: "框架" })]);
    expect(Object.keys(hit).sort()).toEqual(["id", "kind", "modules", "snippet", "title"]);
  });
});
