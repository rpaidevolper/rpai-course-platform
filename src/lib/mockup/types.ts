import type { Blueprint } from "@/lib/blueprint/schema";

/**
 * 設計稿（#22）的領域形狀。名詞依 GLOSSARY.md。
 * 這不是資料庫 schema：資料庫設計是下一步，屆時可能整個重來。
 */

/** 模組：教材分類的一格。A 類是學員課堂上打開的環境，彼此互斥；B 類是不綁工具的方法，可以疊加。 */
export const MODULES = [
  { id: "A1", kind: "A", label: "通用生成 AI" },
  { id: "A2", kind: "A", label: "知識庫與檢索" },
  { id: "A3", kind: "A", label: "桌面自動化" },
  { id: "A4", kind: "A", label: "雲端自動化" },
  { id: "A5", kind: "A", label: "Agent 與 AI 編碼" },
  { id: "B1", kind: "B", label: "流程診斷" },
  { id: "B2", kind: "B", label: "提問與指令" },
  { id: "B3", kind: "B", label: "AI 治理與風險" },
  { id: "B4", kind: "B", label: "AI 成本節費" },
] as const;
export type ModuleId = (typeof MODULES)[number]["id"];
export type ModuleKind = (typeof MODULES)[number]["kind"];

/** 標籤（GLOSSARY）的四組可多選的值；第五組「規格」不存，由總時數推得（tags.ts 的 specOfMinutes）。 */
export const INDUSTRIES = ["金融", "製造", "服務零售", "電商客服", "B2B貿易", "HR", "教育", "公益", "通用"] as const;
export type Industry = (typeof INDUSTRIES)[number];

/** 對象：學員的職務。藍圖裡 audience.who 是這門課自己的描述，這裡是可以篩選的類別。 */
export const AUDIENCES = ["行政", "業務", "財務", "人資", "生管資材", "品保", "門市店長", "部門主管", "種子團隊"] as const;
export type Audience = (typeof AUDIENCES)[number];

/** 工具：課堂上用到的工具。藍圖裡的 tools 有方案與確認狀態，這裡只是篩選用的名稱。 */
export const TOOL_TAGS = [
  "Claude",
  "Claude Project",
  "Claude Code",
  "Claude Skills",
  "NotebookLM",
  "Power Automate",
  "Power Automate Desktop",
  "Microsoft Teams",
  "Excel",
  "Google 試算表",
  "Google Apps Script",
] as const;

/** 應用場景：學員拿 AI 來做的用途，例如簡報、數據分析、文書；它不是模組。 */
export const SCENARIOS = ["文書", "簡報", "數據分析", "客服與信件", "會議與紀錄", "知識整理"] as const;
export type Scenario = (typeof SCENARIOS)[number];

/** 標籤：四組可多選的值（規格另由總時數推得）。單元卡以外的東西都帶全部四組。 */
export interface TagSet {
  audiences: Audience[];
  /** 選項見 TOOL_TAGS；型別放寬成 string，因為真實工具名稱會一直長出來 */
  tools: string[];
  industries: Industry[];
  scenarios: Scenario[];
}

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

export interface ModuleCardVersion {
  version: number;
  createdAt: IsoTime;
  note: string;
  /** 由哪門課程的課後草稿升版；直接整理則為 null */
  fromCourseId: string | null;
}

/** 模組卡：一個模組彙整後的最新版課綱模板。一個模組一張，有版本。 */
export interface ModuleCard {
  moduleId: ModuleId;
  summary: string;
  /** A 類寫學員打開的環境，B 類寫學員帶走的產出 */
  scope: string;
  /** 核心單元骨架：依序排列的單元卡 id，都屬於這個模組 */
  skeletonUnitIds: string[];
  /** 常見搭配，例如「常以 B1 流程診斷定錨」 */
  combos: string[];
  versions: ModuleCardVersion[];
}

/**
 * 單元卡：知識庫裡一段可以重複使用的教學。被哪些課程配方用過由配方推得，不另存。
 * 標籤只存對象、工具、應用場景；產業由用過它的課程配方推得（tags.ts 的 unitTags），不另存。
 */
export interface UnitCard extends Omit<TagSet, "industries"> {
  id: string;
  moduleId: ModuleId;
  title: string;
  minutes: number;
  objective: string;
  method: string;
  outcome: string;
}

export const RECIPE_STATUSES = ["delivered", "proposal", "preparing"] as const;
export type RecipeStatus = (typeof RECIPE_STATUSES)[number];
export const RECIPE_STATUS_LABELS: Record<RecipeStatus, string> = {
  delivered: "已交付",
  proposal: "提案",
  preparing: "籌備中",
};

/** 課程配方：一門過去課程的骨架。總分鐘數、用到的模組與規格由單元卡推得，不另存。它不是藍圖。 */
export interface CourseRecipe extends TagSet {
  id: string;
  title: string;
  client: string;
  status: RecipeStatus;
  /** 上課年月 YYYY-MM；提案與籌備中為 null */
  heldOn: string | null;
  /** 依序用到的單元卡 id */
  unitIds: string[];
}

/** 產業素材包：套在模組上的案例、練習與資料檔。一份藍圖只套用一個。 */
export interface IndustryPack extends TagSet {
  id: string;
  title: string;
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
  /** 選定的產業素材包 */
  industryPackId: string;
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
  /** 講師把這一版標成定稿的時間；null 表示還沒定稿（定稿閘：最新版定稿後才能產逐頁腳本） */
  finalizedAt: IsoTime | null;
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
  /** 講師把這個版本標成定稿的時間；只有逐頁腳本會有，其他一律 null（定稿閘：定稿後才能產下游） */
  finalizedAt: IsoTime | null;
  status: "pending" | "generating" | "ready" | "failed";
  createdAt: IsoTime;
}

export interface Material {
  id: string;
  name: string;
  sizeKb: number;
}

/** 課程的標籤是開課時挑的（預設帶入產業素材包的標籤）；規格不存，由藍圖總時數推得（tags.ts 的 courseSpec）。 */
export interface Course extends TagSet {
  id: string;
  projectId: string;
  title: string;
  /** 藍圖誕生時複製自哪些模組、哪個產業素材包（ADR 0002：記錄來源，不引用） */
  source: { moduleIds: ModuleId[]; industryPackId: string } | null;
  /**
   * 以另一門課程的某一版藍圖為底建立時，記錄複製自哪裡（ADR 0002：複製，之後兩邊各改各的）。
   * 從模組卡或從零談出的課程為 null。
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

/** 場次裡的一天：一對一對應藍圖裡的同一天（days[i] ↔ blueprint.days[i]）。 */
export interface SessionDay {
  startsAt: IsoTime;
  endsAt: IsoTime;
  /** null 表示地點還沒定 */
  venue: string | null;
  /** 這一天的授課講師（instructor.ts 的講師 id） */
  instructorId: string;
}

/**
 * 場次：一群學員把一門課程從頭上完的一次交付。多天的課程是一個場次，
 * days 的長度必須等於藍圖的天數（見 sessionDayCountMismatch）；開始與結束時間由 days 推得。
 */
export interface Session {
  id: string;
  courseId: string;
  days: SessionDay[];
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
  /** 匯入過往講義產生的草稿沒有來源課程，為 null */
  fromCourseId: string | null;
  /** 匯入時的檔名；其他來源為 null */
  importedFileName: string | null;
  createdAt: IsoTime;
  trigger: "auto" | "manual" | "import";
  proposal: DraftProposal;
}

export type DraftProposal =
  | { kind: "module_card_version"; moduleId: ModuleId; changes: string[] }
  | { kind: "new_course_recipe"; recipe: Omit<CourseRecipe, "id" | "unitIds">; unitCards: Omit<UnitCard, "id">[] }
  | { kind: "new_industry_pack"; industryPack: Omit<IndustryPack, "id"> };
