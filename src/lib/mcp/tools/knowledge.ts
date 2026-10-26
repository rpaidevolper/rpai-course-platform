import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { MODULE_IDS } from "@/lib/blueprint/modules";
import { isServable, MAX_QUERY_CHARS, searchKnowledge } from "@/lib/knowledge/search";
import type { KnowledgeStore } from "@/lib/knowledge/store";
import { KNOWLEDGE_KINDS } from "@/lib/knowledge/types";
import { fail, ok } from "./result";

/**
 * 知識庫：設計新課時查模組框架、模組卡、單元卡與課程配方。
 * 知識庫是全團隊共用的（ADR 0004），所以這兩個工具不依 owner 過濾，和課程、工作不同；route 仍然要求權杖。
 * 帶旗標（含客戶名稱）與已退役的文件查不到：這裡再用 isServable 擋一次，不只靠資料庫過濾。
 */
export function registerKnowledgeTools(server: McpServer, store: KnowledgeStore): void {
  server.registerTool(
    "rpai_platform_search_knowledge",
    {
      title: "搜尋知識庫",
      description: [
        "搜尋團隊的知識庫（全團隊共用）。四種文件：",
        "- 模組框架（framework）：總規則，模組怎麼分、一段教學歸哪個模組、一堂課怎麼組。設計課程前一律先讀它。",
        "- 模組卡（module_card）：一個模組的課綱模板，有核心單元骨架與常見搭配。",
        "- 單元卡（unit_card）：一段可以重複使用的教學，有學習目標、教學方式、學員成果與分鐘數；新藍圖的單元從單元卡複製出來。",
        "- 課程配方（recipe）：過去一門課的骨架，依序用了哪些單元卡，加上產業、時數與對象。標題是中性名稱，不含客戶。",
        "建議的查法：先 kind=framework 讀總規則；再依要設計的模組查 kind=module_card 與 kind=unit_card；最後用關鍵字或 kind=recipe 找最相近的幾份配方。",
        "回傳的是摘要與 id，完整內容用 rpai_platform_read_knowledge。已退役或暫停使用（含客戶名稱）的文件查不到。只讀。",
      ].join("\n"),
      inputSchema: z.object({
        query: z
          .string()
          .trim()
          .max(MAX_QUERY_CHARS)
          .optional()
          .describe("關鍵字，用空白分開，不分大小寫。省略就依種類與標題列出"),
        kind: z.enum(KNOWLEDGE_KINDS).optional().describe("只查這一種：framework、module_card、unit_card、recipe"),
        module: z.enum(MODULE_IDS).optional().describe("只查這個模組，例如 A1"),
        limit: z.number().int().min(1).max(50).optional().describe("最多幾筆，預設 20，最多 50"),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ query, kind, module, limit }) => {
      const docs = await store.list({ kind, module });
      const documents = searchKnowledge(docs, { query, kind, module, limit });
      return ok({ count: documents.length, documents });
    },
  );

  server.registerTool(
    "rpai_platform_read_knowledge",
    {
      title: "讀取知識庫文件",
      description: [
        "讀一份知識庫文件的完整內容（frontmatter 與 Markdown 本文）。只讀。找不到、已停用或暫停使用的文件會回錯誤。",
        "設計新課時，單元從單元卡複製出來：藍圖單元的 source 寫 { kind: \"unit_card\", id: <這個 id>, version: null, unit: <單元卡標題> }，",
        "reuse 依改動程度填：原樣沿用填 reuse，要改寫填 modify。",
      ].join("\n"),
      inputSchema: z.object({
        id: z.string().uuid().describe("知識庫文件 id，從 rpai_platform_search_knowledge 取得"),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ id }) => {
      const doc = await store.get(id);
      if (!doc || !isServable(doc)) {
        return fail("找不到這份知識庫文件，或它已經停用。先用 rpai_platform_search_knowledge 查 id。");
      }
      return ok({ id: doc.id, kind: doc.kind, modules: doc.modules, title: doc.title, frontmatter: doc.frontmatter, body: doc.body });
    },
  );
}
