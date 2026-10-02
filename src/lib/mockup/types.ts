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

export const ARTIFACT_KINDS = ["outline", "slides", "handbook"] as const;
export type ArtifactKind = (typeof ARTIFACT_KINDS)[number];
export const ARTIFACT_LABELS: Record<ArtifactKind, string> = {
  outline: "課程大綱",
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

export interface ClientContext {
  company: string;
  industry: string;
  goal: string;
  scenarioId: string;
}

export interface Project {
  id: string;
  title: string;
  /** 只是一個資訊欄位，只有講師看得到 */
  priceTwd: number;
  clientContext: ClientContext;
}

export interface BlueprintVersion {
  version: number;
  createdAt: IsoTime;
  note: string;
}

export interface Artifact {
  id: string;
  kind: ArtifactKind;
  version: number;
  blueprintVersion: number;
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
  venue: string;
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
