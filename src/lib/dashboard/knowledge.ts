import { MODULE_IDS } from "@/lib/blueprint/modules";
import type { BrowseFilter } from "@/lib/knowledge/browse";
import { isServable, MAX_QUERY_CHARS } from "@/lib/knowledge/search";
import type { KnowledgeStore } from "@/lib/knowledge/store";
import { KNOWLEDGE_KINDS, type KnowledgeDocument, type KnowledgeKind } from "@/lib/knowledge/types";
import { isUuid } from "./store";

/**
 * 網頁的知識庫頁用的小工具。知識庫全團隊共用，本來就不以 owner 過濾；
 * 讀取一樣只能在通過登入檢查的頁面裡用。
 */

type SearchParams = Record<string, string | string[] | undefined>;

/** 網址參數（kind、module、q）轉成篩選；不認得的值當作沒篩選，不報錯。 */
export function parseBrowseFilter(params: SearchParams): BrowseFilter {
  const filter: BrowseFilter = {};
  const kind = firstParam(params.kind);
  if (kind !== undefined && (KNOWLEDGE_KINDS as readonly string[]).includes(kind)) filter.kind = kind as KnowledgeKind;
  const moduleId = firstParam(params.module);
  if (moduleId !== undefined && (MODULE_IDS as readonly string[]).includes(moduleId)) filter.module = moduleId;
  const query = firstParam(params.q)?.trim().slice(0, MAX_QUERY_CHARS);
  if (query) filter.query = query;
  return filter;
}

/**
 * 單篇頁讀一份文件。只回 AI 查得到的（和 MCP 的 read_knowledge 一樣用 isServable）：
 * 暫停使用的本文含客戶名稱，用網址直接打開也看不到。不是 uuid 就不送查詢。找不到一律回 null。
 */
export async function readKnowledgeDocument(store: KnowledgeStore, id: string): Promise<KnowledgeDocument | null> {
  if (!isUuid(id)) return null;
  const doc = await store.get(id);
  return doc && isServable(doc) ? doc : null;
}

/** 同一個參數出現多次時只取第一個 */
function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
