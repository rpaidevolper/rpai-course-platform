import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ExistingRow } from "./sync-plan.ts";
import type { Frontmatter, KnowledgeDocument, KnowledgeKind } from "./types.ts";

/** MCP 用的唯讀存取。全團隊共用，不以 owner 過濾。 */
export interface KnowledgeFilter {
  kind?: KnowledgeKind;
  module?: string;
}

export interface KnowledgeStore {
  /** 資料庫端已排除退役的文件；工具層還會再用 isServable 過濾旗標。 */
  list(filter: KnowledgeFilter): Promise<KnowledgeDocument[]>;
  get(id: string): Promise<KnowledgeDocument | null>;
}

/** 同步寫入的一列（id 由資料庫依 source_key 決定，所以不含 id）。 */
export interface DocumentRow {
  source_key: string;
  kind: KnowledgeKind;
  modules: string[];
  title: string;
  frontmatter: Frontmatter;
  body: string;
  content_hash: string;
  flags: string[];
  synced_at: string;
}

/** 同步用的存取：讀現有狀態、依 source_key 寫入、設定退役。 */
export interface SyncStore {
  listExisting(): Promise<ExistingRow[]>;
  /** 依 source_key 新增或更新，寫入後 retired_at 是 null。 */
  upsert(rows: DocumentRow[]): Promise<void>;
  /** 把這些 id 標成退役。 */
  retire(ids: string[], at: string): Promise<void>;
}

const TABLE = "knowledge_documents";
const DOCUMENT_COLUMNS = "id, kind, modules, title, frontmatter, body, flags, retired_at";
/** 分頁大小（PostgREST 預設最多回 1000 列，超過要分頁，否則會悄悄漏掉文件）。 */
const PAGE_SIZE = 500;
/** 寫入一批的列數，避免單次請求太大。 */
const WRITE_BATCH = 100;

export function createSupabaseKnowledgeStore(client: SupabaseClient): KnowledgeStore {
  return {
    async list(filter) {
      const docs: KnowledgeDocument[] = [];
      for (let from = 0; ; from += PAGE_SIZE) {
        let query = client.from(TABLE).select(DOCUMENT_COLUMNS).is("retired_at", null);
        if (filter.kind) query = query.eq("kind", filter.kind);
        if (filter.module) query = query.contains("modules", [filter.module]);
        const { data, error } = await query.order("id").range(from, from + PAGE_SIZE - 1);
        if (error) throw error;
        const page = (data ?? []) as KnowledgeDocument[];
        docs.push(...page);
        if (page.length < PAGE_SIZE) return docs;
      }
    },

    async get(id) {
      const { data, error } = await client.from(TABLE).select(DOCUMENT_COLUMNS).eq("id", id).maybeSingle();
      if (error) throw error;
      return (data as KnowledgeDocument | null) ?? null;
    },
  };
}

export function createSupabaseSyncStore(client: SupabaseClient): SyncStore {
  return {
    async listExisting() {
      const rows: ExistingRow[] = [];
      for (let from = 0; ; from += PAGE_SIZE) {
        const { data, error } = await client
          .from(TABLE)
          .select("id, source_key, content_hash, retired_at")
          .order("id")
          .range(from, from + PAGE_SIZE - 1);
        if (error) throw error;
        const page = (data ?? []) as ExistingRow[];
        rows.push(...page);
        if (page.length < PAGE_SIZE) return rows;
      }
    },

    async upsert(rows) {
      for (const batch of chunk(rows, WRITE_BATCH)) {
        const { error } = await client
          .from(TABLE)
          .upsert(
            batch.map((row) => ({ ...row, retired_at: null })),
            { onConflict: "source_key" },
          );
        if (error) throw error;
      }
    },

    async retire(ids, at) {
      for (const batch of chunk(ids, WRITE_BATCH)) {
        const { error } = await client.from(TABLE).update({ retired_at: at }).in("id", batch);
        if (error) throw error;
      }
    },
  };
}

/** 記憶體裡的一列（試跑與測試用）。 */
export interface MemoryRow extends DocumentRow {
  id: string;
  retired_at: string | null;
}

export interface MemorySyncStore extends SyncStore {
  rows(): MemoryRow[];
  /** upsert 與 retire 的呼叫次數；試跑時必須是 0。 */
  writeCalls(): number;
}

/**
 * 記憶體版的 SyncStore：沒有 Supabase 設定時（試跑），平台視為空的；測試也用它模擬資料庫。
 * 它會照資料庫的規則做事：依 source_key 合併、寫入時清掉 retired_at、id 第一次寫入時產生。
 */
export function createMemorySyncStore(): MemorySyncStore {
  const byKey = new Map<string, MemoryRow>();
  let calls = 0;

  return {
    async listExisting() {
      return [...byKey.values()].map((row) => ({
        id: row.id,
        source_key: row.source_key,
        content_hash: row.content_hash,
        retired_at: row.retired_at,
      }));
    },

    async upsert(rows) {
      calls++;
      for (const row of rows) {
        const previous = byKey.get(row.source_key);
        byKey.set(row.source_key, { ...row, id: previous?.id ?? randomUUID(), retired_at: null });
      }
    },

    async retire(ids, at) {
      calls++;
      for (const row of byKey.values()) {
        if (ids.includes(row.id)) row.retired_at = at;
      }
    },

    rows: () => [...byKey.values()],
    writeCalls: () => calls,
  };
}

function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) batches.push(items.slice(i, i + size));
  return batches;
}
