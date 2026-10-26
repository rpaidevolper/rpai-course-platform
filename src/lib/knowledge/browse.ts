import { isServable, rankKnowledge, type SearchHit, type SearchOptions } from "./search.ts";
import { KNOWLEDGE_KIND_LABELS, KNOWLEDGE_KINDS, type KnowledgeDocument, type KnowledgeKind } from "./types.ts";

export type BrowseFilter = Omit<SearchOptions, "limit">;

export interface BrowseGroup {
  kind: KnowledgeKind;
  label: string;
  items: SearchHit[];
}

export interface BrowseResult {
  /** 符合篩選的文件，依種類分組；沒有文件的種類不出現 */
  groups: BrowseGroup[];
  /** 不看篩選的各種類份數：available 是 AI 查得到的，paused 是含客戶名稱而暫停使用的（退役的不算） */
  counts: Record<KnowledgeKind, { available: number; paused: number }>;
  /** 還沒退役的文件裡最新的 synced_at。內容沒變的文件同步時不會更新它，所以這是「內容最後更新」，不是最後跑同步的時間。沒有文件是 null */
  lastChangedAt: string | null;
}

/**
 * 網頁的知識庫列表（純函式）。和 MCP 用同一套過濾與排序（rankKnowledge），所以網頁看到的就是 AI 查得到的；
 * 但不設筆數上限。暫停使用的文件只計數量，標題與內容都不出現。
 */
export function browseKnowledge(docs: KnowledgeDocument[], filter: BrowseFilter): BrowseResult {
  const hits = rankKnowledge(docs, filter);
  const groups = KNOWLEDGE_KINDS.map((kind) => ({
    kind,
    label: KNOWLEDGE_KIND_LABELS[kind],
    items: hits.filter((hit) => hit.kind === kind),
  })).filter((group) => group.items.length > 0);

  const current = docs.filter((doc) => !doc.retired_at);
  const counts = Object.fromEntries(
    KNOWLEDGE_KINDS.map((kind) => {
      const ofKind = current.filter((doc) => doc.kind === kind);
      const available = ofKind.filter((doc) => isServable(doc)).length;
      return [kind, { available, paused: ofKind.length - available }];
    }),
  ) as BrowseResult["counts"];

  const lastChangedAt = current.reduce<string | null>(
    (latest, doc) => (latest === null || doc.synced_at > latest ? doc.synced_at : latest),
    null,
  );

  return { groups, counts, lastChangedAt };
}
