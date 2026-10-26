/**
 * 知識庫的型別與常數。這個資料夾會被 node --experimental-strip-types 直接執行（scripts/kb-sync.ts），
 * 所以只能用相對路徑 import（要寫 .ts），型別一律用 import type。
 */

export const KNOWLEDGE_KINDS = ["framework", "module_card", "unit_card", "recipe"] as const;
export type KnowledgeKind = (typeof KNOWLEDGE_KINDS)[number];

export const KNOWLEDGE_KIND_LABELS: Record<KnowledgeKind, string> = {
  framework: "模組框架",
  module_card: "模組卡",
  unit_card: "單元卡",
  recipe: "課程配方",
};

/** 文字裡含客戶名稱時加的旗標：這份文件 AI 查不到，直到講師在資料夾裡改寫並重跑同步。 */
export const CLIENT_NAME_FLAG = "client_name_in_reusable_text";

export type FrontmatterScalar = string | number | boolean | null;
export type FrontmatterValue = FrontmatterScalar | FrontmatterScalar[];
export type Frontmatter = Record<string, FrontmatterValue>;

/** 資料夾裡的一個 Markdown 檔（path 用 / 分隔，相對於資料夾）。 */
export interface MarkdownFile {
  path: string;
  text: string;
}

/** 要存進平台的一份文件（還沒有 id） */
export interface KnowledgeDocumentInput {
  kind: KnowledgeKind;
  source_key: string;
  modules: string[];
  title: string;
  frontmatter: Frontmatter;
  body: string;
  content_hash: string;
  flags: string[];
  /** 相對於資料夾的路徑，只給同步報告用，不存進資料庫。客戶名稱已遮掉（names.ts 的 mask）。 */
  path: string;
}

/** 平台上的一份文件 */
export interface KnowledgeDocument {
  id: string;
  kind: KnowledgeKind;
  modules: string[];
  title: string;
  frontmatter: Frontmatter;
  body: string;
  flags: string[];
  retired_at: string | null;
  /** 最後一次同步寫入這份文件的時間 */
  synced_at: string;
}
