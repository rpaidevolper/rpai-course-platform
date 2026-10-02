import type { Blueprint } from "@/lib/blueprint/schema";

/**
 * 設計稿（#22）的領域形狀。名詞依 GLOSSARY.md。
 * 這不是資料庫 schema：資料庫設計是下一步，屆時可能整個重來。
 */

export const TOPICS = [
  { id: "claude", label: "Claude" },
  { id: "gas", label: "Google Apps Script" },
  { id: "power-automate", label: "Power Automate" },
] as const;
export type TopicId = (typeof TOPICS)[number]["id"];

/**
 * 設計稿的產物種類（ADR 0003）。和 `src/lib/artifacts.ts`（MCP／plugin 用的真實種類）是兩回事。
 * 鏈：藍圖 → 課程大綱、講師準備單；藍圖 → 逐頁腳本（每天）→ 簡報（每天）；各天逐頁腳本 → 學員手冊。
 */
export const ARTIFACT_KINDS = ["outline", "prep_sheet", "page_script", "slides", "handbook"] as const;
export type ArtifactKind = (typeof ARTIFACT_KINDS)[number];
export const ARTIFACT_LABELS: Record<ArtifactKind, string> = {
  outline: "課程大綱",
  prep_sheet: "講師準備單",
  page_script: "逐頁腳本",
  slides: "簡報",
  handbook: "學員手冊",
};


/** ISO 8601，一律帶 +08:00。 */
export type IsoTime = string;

export interface FrameworkVersion {
  version: number;
  createdAt: IsoTime;
  note: string;
  /** 由哪門課程的課後草稿升版；直接編輯則為 null */
  fromCourseId: string | null;
}

export interface Framework {
  id: string;
  topicId: TopicId;
  title: string;
  summary: string;
  moduleTitles: string[];
  versions: FrameworkVersion[];
}

export interface Scenario {
  id: string;
  title: string;
  industry: string;
  audience: string;
  cases: string[];
  materialNames: string[];
}

/** 客戶品牌：有填就取代 RPAI 預設品牌。 */
export interface ClientBrand {
  name: string;
  /** 主題色，#RRGGBB */
  primaryColor: string;
  note: string;
}

export interface ClientContext {
  company: string;
  industry: string;
  goal: string;
  scenarioId: string;
  /** 客戶的 IT 限制；新藍圖會把它複製進工具清單 */
  itConstraints: string[];
  /** null 表示沿用 RPAI 品牌 */
  brand: ClientBrand | null;
}

/** 專案狀態：洽談中就建立；沒成交就封存。 */
export const PROJECT_STATUSES = ["negotiating", "active", "archived"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  negotiating: "洽談中",
  active: "進行中",
  archived: "封存",
};

export const CLIENT_DOCUMENT_KINDS = ["original_syllabus", "requirements", "planning_template", "feedback"] as const;
export type ClientDocumentKind = (typeof CLIENT_DOCUMENT_KINDS)[number];
export const CLIENT_DOCUMENT_LABELS: Record<ClientDocumentKind, string> = {
  original_syllabus: "原課綱",
  requirements: "需求",
  planning_template: "規劃表範本",
  feedback: "回饋",
};

/** 客戶文件：客戶給的檔案或回饋。屬於專案，學員永遠看不到。 */
export interface ClientDocument {
  id: string;
  kind: ClientDocumentKind;
  title: string;
  fileName: string;
  receivedAt: IsoTime;
  /** 回饋回應的是哪一版課程大綱（產物 id）；只有回饋可以填，其餘一律 null */
  respondsToOutlineId: string | null;
}

/** 需求條目：從客戶文件整理出的一條要求，由專案底下的一門課程負責。 */
export interface Requirement {
  id: string;
  text: string;
  /** 出自哪份客戶文件；講師口頭記下的則為 null */
  sourceDocumentId: string | null;
  /**
   * 需求對照用的關鍵詞（講師從原文挑出；真實版本可由 AI 抽出）。
   * 全部出現在藍圖同一個單元裡，才算字面上涵蓋。
   */
  keywords: string[];
  /** 客戶要求的時數（分鐘）；沒指定時數則為 null */
  minutes: number | null;
  /** 負責的課程；null 表示還沒人負責 */
  courseId: string | null;
}

/**
 * 需求條目是否被藍圖「實質」涵蓋的判斷。字面與時數由 mapRequirements 計算；
 * 內容有沒有真的教到，設計稿用 fixture 標註，真實版本未來交給 AI。
 */
export interface RequirementReview {
  requirementId: string;
  substantive: boolean;
  note: string;
}

export interface Project {
  id: string;
  title: string;
  status: ProjectStatus;
  /** 只是一個資訊欄位，只有講師看得到 */
  priceTwd: number;
  clientContext: ClientContext;
  clientDocuments: ClientDocument[];
  requirements: Requirement[];
}

export interface BlueprintVersion {
  version: number;
  createdAt: IsoTime;
  note: string;
}

/** 產物的一個版本。同一種類（逐頁腳本與簡報再加上同一天）的各版本是同一份產物。 */
export interface Artifact {
  id: string;
  kind: ArtifactKind;
  /** 第幾天（從 1 起算）；只有逐頁腳本與簡報有，其他一律 null */
  day: number | null;
  version: number;
  /** 出自哪一版藍圖 */
  blueprintVersion: number;
  /** 上游產物版本的 id：簡報 → 該天逐頁腳本；學員手冊 → 各天逐頁腳本；其他為空陣列 */
  upstreamIds: string[];
  /** 講師修改後上傳的版本：指向它改自哪個版本，並沿用那個版本的藍圖與上游綁定；AI 產出的為 null */
  editedFromId: string | null;
  /** 已寄給客戶的時間；只有課程大綱會有，其他一律 null */
  sentToClientAt: IsoTime | null;
  status: "pending" | "generating" | "ready" | "failed";
  createdAt: IsoTime;
}

export interface Material {
  id: string;
  name: string;
  sizeKb: number;
}

export interface Course {
  id: string;
  projectId: string;
  title: string;
  /** 藍圖誕生時複製自哪個框架的哪一版、哪個情境（ADR 0002：記錄來源，不引用） */
  source: { frameworkId: string; frameworkVersion: number; scenarioId: string } | null;
  /**
   * 以另一門課程的某一版藍圖為底建立時，記錄複製自哪裡（ADR 0002：複製，之後兩邊各改各的）。
   * 從框架或從零談出的課程為 null。
   */
  copiedFrom: { courseId: string; blueprintVersion: number } | null;
  /** 最新一版藍圖的內容；舊版只列出版本紀錄 */
  blueprint: Blueprint;
  blueprintHistory: BlueprintVersion[];
  artifacts: Artifact[];
  materials: Material[];
}

export interface Link {
  label: string;
  url: string;
}

/** 發布：替場次鎖定要給學員的產物版本、素材與連結。 */
export interface Publication {
  publishedAt: IsoTime;
  artifactIds: string[];
  materialIds: string[];
  links: Link[];
}

export interface Session {
  id: string;
  courseId: string;
  startsAt: IsoTime;
  endsAt: IsoTime;
  /** null 表示地點還沒定 */
  venue: string | null;
  links: Link[];
  publication: Publication | null;
  portal: {
    code: string;
    /** 講師提前關閉的時間；null 表示沒有關閉 */
    closedAt: IsoTime | null;
    /** 講師延長後的到期時間；null 表示用預設（課後 30 天） */
    expiresAtOverride: IsoTime | null;
  };
}

export interface KnowledgeDraft {
  id: string;
  fromCourseId: string;
  createdAt: IsoTime;
  trigger: "auto" | "manual" | "import";
  proposal:
    | { kind: "framework_version"; frameworkId: string; changes: string[] }
    | { kind: "new_scenario"; scenario: Omit<Scenario, "id"> };
}
