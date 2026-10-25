import { buildKnowledgeDocuments } from "./documents.ts";
import type { DocumentRow, SyncStore } from "./store.ts";
import { planSync, type SyncPlan } from "./sync-plan.ts";
import { KNOWLEDGE_KIND_LABELS, KNOWLEDGE_KINDS, type KnowledgeDocumentInput, type MarkdownFile } from "./types.ts";

export interface RunSyncOptions {
  files: MarkdownFile[];
  aliasesText: string | null;
  /** false 是試跑：只出報告，store 完全不寫入。 */
  apply: boolean;
  store: SyncStore;
  now: Date;
  log: (line: string) => void;
}

export interface RunSyncResult {
  ok: boolean;
  written: boolean;
  plan: SyncPlan | null;
}

/**
 * 把資料夾同步進平台：建立文件 → 有硬錯誤就印出來、不寫入 → 讀平台現況 → 算計畫 → 印報告 → apply 才寫入。
 * 報告只印檔名與數量，絕不印出名稱表裡的名稱（檔名與路徑在 buildKnowledgeDocuments 裡已經遮掉）。
 */
export async function runSync(options: RunSyncOptions): Promise<RunSyncResult> {
  const { files, aliasesText, apply, store, now, log } = options;

  const built = buildKnowledgeDocuments(files, aliasesText);
  if (built.errors.length > 0) {
    log("知識庫同步失敗：有硬錯誤，沒有寫入。修正下面的檔案後重跑。");
    for (const error of built.errors) log(`  - ${error}`);
    return { ok: false, written: false, plan: null };
  }

  const plan = planSync(built.documents, await store.listExisting());
  for (const line of reportLines({ apply, fileCount: files.length, skipped: built.skipped.length, documents: built.documents, names: built.names, plan })) {
    log(line);
  }
  if (!apply) return { ok: true, written: false, plan };

  const syncedAt = now.toISOString();
  const rows = [...plan.inserts, ...plan.updates.map((update) => update.doc)].map((doc) => toRow(doc, syncedAt));
  if (rows.length > 0) await store.upsert(rows);
  if (plan.retirements.length > 0) await store.retire(plan.retirements, syncedAt);
  return { ok: true, written: true, plan };
}

function toRow(doc: KnowledgeDocumentInput, syncedAt: string): DocumentRow {
  return {
    source_key: doc.source_key,
    kind: doc.kind,
    modules: doc.modules,
    title: doc.title,
    frontmatter: doc.frontmatter,
    body: doc.body,
    content_hash: doc.content_hash,
    flags: doc.flags,
    synced_at: syncedAt,
  };
}

function reportLines(input: {
  apply: boolean;
  fileCount: number;
  skipped: number;
  documents: KnowledgeDocumentInput[];
  names: { total: number; fromRecipes: number; fromAliases: number };
  plan: SyncPlan;
}): string[] {
  const { apply, fileCount, skipped, documents, names, plan } = input;
  const kindCounts = KNOWLEDGE_KINDS.map(
    (kind) => `${KNOWLEDGE_KIND_LABELS[kind]} ${documents.filter((doc) => doc.kind === kind).length}`,
  ).join("、");
  const flagged = documents.filter((doc) => doc.flags.length > 0);

  return [
    apply ? "知識庫同步（已寫入）" : "知識庫同步（試跑，沒有寫入；加 --apply 才會寫入）",
    `讀到 ${fileCount} 個 Markdown：${kindCounts}；略過 ${skipped} 個（不是知識庫文件）`,
    `名稱表：${names.total} 個名稱（配方 ${names.fromRecipes}、別名檔 ${names.fromAliases}）。報告不列出名稱。`,
    `暫停使用：${flagged.length} 份文字含客戶名稱，AI 查不到，修正資料夾後重跑。`,
    ...flagged.map((doc) => `  - ${doc.path}`),
    `與平台比對：新增 ${plan.inserts.length}、更新 ${plan.updates.length}、不變 ${plan.unchanged.length}、退役 ${plan.retirements.length}`,
    "注意：這份報告含檔名，不要貼到 issue、PR 或對話裡。",
  ];
}
