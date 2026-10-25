import type { KnowledgeDocumentInput } from "./types.ts";

/** 平台現有的一列（只要比對需要的欄位）。 */
export interface ExistingRow {
  id: string;
  source_key: string;
  content_hash: string;
  retired_at: string | null;
}

export interface SyncPlan {
  inserts: KnowledgeDocumentInput[];
  /** 已存在但內容或旗標變了，或已退役又出現的：更新，並清掉 retired_at */
  updates: { id: string; doc: KnowledgeDocumentInput }[];
  /** 已存在、內容一樣、沒有退役 */
  unchanged: string[];
  /** 平台有、這次資料夾沒有、還沒退役的 id */
  retirements: string[];
}

/** 比對資料夾這次的文件與平台現有的列（純函式）。 */
export function planSync(docs: KnowledgeDocumentInput[], existing: ExistingRow[]): SyncPlan {
  const bySourceKey = new Map(existing.map((row) => [row.source_key, row]));
  const seen = new Set<string>();
  const plan: SyncPlan = { inserts: [], updates: [], unchanged: [], retirements: [] };

  for (const doc of docs) {
    seen.add(doc.source_key);
    const row = bySourceKey.get(doc.source_key);
    if (!row) {
      plan.inserts.push(doc);
    } else if (!row.retired_at && row.content_hash === doc.content_hash) {
      plan.unchanged.push(row.id);
    } else {
      plan.updates.push({ id: row.id, doc });
    }
  }

  for (const row of existing) {
    if (!seen.has(row.source_key) && !row.retired_at) plan.retirements.push(row.id);
  }
  return plan;
}
