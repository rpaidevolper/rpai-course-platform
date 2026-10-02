import { openItems } from "@/lib/blueprint/open-items";
import { mapRequirements, type RequirementMapping } from "@/lib/blueprint/requirement-mapping";
import { checkBlueprint, missingElements, FIVE_ELEMENT_LABELS, type Blueprint, type UnitSource } from "@/lib/blueprint/schema";
import {
  COURSES,
  FRAMEWORKS,
  KNOWLEDGE_DRAFTS,
  PROJECTS,
  REQUIREMENT_REVIEWS,
  SCENARIOS,
  SESSIONS,
} from "./data";
import {
  ARTIFACT_KINDS,
  ARTIFACT_LABELS,
  PROJECT_STATUSES,
  type Artifact,
  type ArtifactKind,
  type Course,
  type Framework,
  type IsoTime,
  type Link,
  type Material,
  type Project,
  type ProjectStatus,
  type Requirement,
  type RequirementReview,
  type Scenario,
  type Session,
} from "./types";

/** 純函式：所有「現在」都由呼叫端傳入（設計稿用 MOCK_NOW）。 */

const DAY_MS = 24 * 60 * 60 * 1000;
/** 學員入口預設在課後多久失效 */
export const PORTAL_VALID_DAYS = 30;

const ms = (t: IsoTime) => new Date(t).getTime();

// ── 查詢 ──────────────────────────────────────────────

export const getProject = (id: string) => PROJECTS.find((p) => p.id === id);
export const getCourse = (id: string) => COURSES.find((c) => c.id === id);
export const getSession = (id: string) => SESSIONS.find((s) => s.id === id);
export const getFramework = (id: string) => FRAMEWORKS.find((f) => f.id === id);
export const getScenario = (id: string) => SCENARIOS.find((s) => s.id === id);
export const getSessionByPortalCode = (code: string) =>
  SESSIONS.find((s) => s.portal.code === code);

export const coursesOfProject = (projectId: string) =>
  COURSES.filter((c) => c.projectId === projectId);

export const sessionsOfCourse = (courseId: string) =>
  SESSIONS.filter((s) => s.courseId === courseId).sort((a, b) => ms(a.startsAt) - ms(b.startsAt));

export const latestFrameworkVersion = (f: Framework) =>
  Math.max(...f.versions.map((v) => v.version));

export const frameworksOfTopic = (topicId: string) =>
  FRAMEWORKS.filter((f) => f.topicId === topicId);

export const pendingDrafts = () => KNOWLEDGE_DRAFTS;

// ── 藍圖與產物 ────────────────────────────────────────

export const latestBlueprintVersion = (course: Course) =>
  Math.max(...course.blueprintHistory.map((v) => v.version));

/** 產物過期：出自比課程最新藍圖更舊的版本（docs/architecture.md） */
export const isStale = (course: Course, artifact: Artifact) =>
  artifact.blueprintVersion < latestBlueprintVersion(course);

/** 每一種產物目前最新的一版；還沒產過則為 undefined */
export function latestArtifact(course: Course, kind: ArtifactKind): Artifact | undefined {
  return course.artifacts
    .filter((a) => a.kind === kind)
    .sort((a, b) => b.version - a.version)[0];
}

/** 單元來源的顯示文字：「Claude 入門」藍圖 v3・提示詞的四個零件 */
export function unitSourceText(source: UnitSource): string {
  if (source.kind === "course") {
    const title = getCourse(source.id)?.title ?? source.id;
    return `課程「${title}」藍圖 v${source.version}・${source.unit}`;
  }
  const title = getFramework(source.id)?.title ?? source.id;
  return `框架「${title}」v${source.version}・${source.unit}`;
}

/** 要改與新做的單元各幾個，由藍圖完整性檢查推得。 */
export function unitWorkCounts(bp: Blueprint): { modify: number; new: number } {
  const counts = { modify: 0, new: 0 };
  for (const issue of checkBlueprint(bp)) {
    if (issue.kind === "unit_needs_work") counts[issue.reuse] += 1;
  }
  return counts;
}

// ── 準備度 ────────────────────────────────────────────

export type ReadinessItem =
  | { kind: "open_questions"; count: number }
  | { kind: "missing_elements"; labels: string[] }
  | { kind: "units_need_work"; modify: number; new: number }
  | { kind: "artifact_missing"; artifact: ArtifactKind }
  | { kind: "artifact_stale"; artifact: ArtifactKind; version: number }
  | { kind: "no_materials" }
  | { kind: "no_links" }
  | { kind: "venue_unset" }
  | { kind: "unpublished" }
  | { kind: "publication_outdated"; artifacts: ArtifactKind[] };

/** 一個場次距離可以上課還缺哪些事。空陣列代表準備好了。 */
export function readiness(session: Session): ReadinessItem[] {
  const course = getCourse(session.courseId);
  if (!course) throw new Error(`場次 ${session.id} 找不到課程 ${session.courseId}`);
  const items: ReadinessItem[] = [];

  const open = openItems(course.blueprint);
  if (open.length > 0) {
    items.push({ kind: "open_questions", count: open.length });
  }
  const missing = missingElements(course.blueprint);
  if (missing.length > 0) {
    items.push({ kind: "missing_elements", labels: missing.map((k) => FIVE_ELEMENT_LABELS[k]) });
  }
  const work = unitWorkCounts(course.blueprint);
  if (work.modify + work.new > 0) items.push({ kind: "units_need_work", ...work });
  for (const kind of ARTIFACT_KINDS) {
    const a = latestArtifact(course, kind);
    if (!a) items.push({ kind: "artifact_missing", artifact: kind });
    else if (isStale(course, a)) items.push({ kind: "artifact_stale", artifact: kind, version: a.version });
  }
  if (course.materials.length === 0) items.push({ kind: "no_materials" });
  if (session.links.length === 0) items.push({ kind: "no_links" });
  if (session.venue === null) items.push({ kind: "venue_unset" });

  if (!session.publication) {
    items.push({ kind: "unpublished" });
  } else {
    const pinned = new Set(session.publication.artifactIds);
    const outdated = ARTIFACT_KINDS.filter((kind) => {
      const latest = latestArtifact(course, kind);
      return latest && latest.status === "ready" && !pinned.has(latest.id);
    });
    if (outdated.length > 0) items.push({ kind: "publication_outdated", artifacts: outdated });
  }
  return items;
}

export function readinessText(item: ReadinessItem): string {
  switch (item.kind) {
    case "open_questions":
      return `藍圖還有 ${item.count} 個待確認事項`;
    case "missing_elements":
      return `藍圖缺五元素：${item.labels.join("、")}`;
    case "units_need_work":
      return `還有 ${[item.modify && `${item.modify} 個單元要改`, item.new && `${item.new} 個單元要新做`].filter(Boolean).join("、")}`;
    case "artifact_missing":
      return `還沒產出${ARTIFACT_LABELS[item.artifact]}`;
    case "artifact_stale":
      return `${ARTIFACT_LABELS[item.artifact]} v${item.version} 已過期，藍圖改過了`;
    case "no_materials":
      return "還沒上傳素材";
    case "no_links":
      return "還沒填 Slido 等連結";
    case "venue_unset":
      return "地點還沒定";
    case "unpublished":
      return "還沒發布給學員";
    case "publication_outdated":
      return `有較新的${item.artifacts.map((k) => ARTIFACT_LABELS[k]).join("、")}還沒發布`;
  }
}

/** 講師首頁：還沒結束的場次，依開始時間排序。 */
export function upcomingSessions(now: IsoTime): Session[] {
  return SESSIONS.filter((s) => ms(s.endsAt) >= ms(now)).sort(
    (a, b) => ms(a.startsAt) - ms(b.startsAt),
  );
}

// ── 學員入口 ──────────────────────────────────────────

export function portalExpiresAt(session: Session): IsoTime {
  return (
    session.portal.expiresAtOverride ??
    new Date(ms(session.endsAt) + PORTAL_VALID_DAYS * DAY_MS).toISOString()
  );
}

export type PortalState = "unpublished" | "open" | "expired" | "closed";

export function portalState(session: Session, now: IsoTime): PortalState {
  if (!session.publication) return "unpublished";
  if (session.portal.closedAt && ms(session.portal.closedAt) <= ms(now)) return "closed";
  if (ms(now) > ms(portalExpiresAt(session))) return "expired";
  return "open";
}

/**
 * 學員入口看得到的東西。型別上刻意不含專案與價格，學員入口頁只能用這個函式取資料。
 * 只回傳發布時鎖定的內容，講師之後的修改不會出現。
 */
export interface PortalView {
  state: PortalState;
  courseTitle: string;
  startsAt: IsoTime;
  endsAt: IsoTime;
  venue: string | null;
  expiresAt: IsoTime;
  artifacts: { id: string; label: string; version: number }[];
  materials: Material[];
  links: Link[];
}

export function portalView(code: string, now: IsoTime): PortalView | undefined {
  const session = getSessionByPortalCode(code);
  if (!session) return undefined;
  const course = getCourse(session.courseId)!;
  const state = portalState(session, now);
  const pub = state === "open" ? session.publication : null;

  return {
    state,
    courseTitle: course.title,
    startsAt: session.startsAt,
    endsAt: session.endsAt,
    venue: session.venue,
    expiresAt: portalExpiresAt(session),
    artifacts: pub
      ? course.artifacts
          .filter((a) => pub.artifactIds.includes(a.id))
          .map((a) => ({ id: a.id, label: ARTIFACT_LABELS[a.kind], version: a.version }))
      : [],
    materials: pub ? course.materials.filter((m) => pub.materialIds.includes(m.id)) : [],
    links: pub ? pub.links : [],
  };
}

// ── 顯示格式 ──────────────────────────────────────────

const TZ = "Asia/Taipei";

export const formatDate = (t: IsoTime) =>
  new Intl.DateTimeFormat("zh-TW", { timeZone: TZ, month: "long", day: "numeric", weekday: "short" }).format(new Date(t));

export const formatTime = (t: IsoTime) =>
  new Intl.DateTimeFormat("zh-TW", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(t));

export const formatDateTime = (t: IsoTime) =>
  new Intl.DateTimeFormat("zh-TW", { timeZone: TZ, year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(t));

/** 日期軸用：{ day: "15", month: "10 月" } */
export function dateParts(t: IsoTime): { day: string; month: string } {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: TZ, month: "numeric", day: "numeric" }).formatToParts(new Date(t));
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return { day: get("day"), month: `${get("month")} 月` };
}

/** 地點還沒定時顯示的文字 */
export const VENUE_UNSET = "地點未定";

export const formatTwd = (n: number) => `NT$ ${n.toLocaleString("en-US")}`;

export type { Project, Course, Session, Framework, Scenario };

// ── 專案：狀態、客戶文件與需求條目 ───────────────────────

/** 專案列表依狀態分組，順序固定為洽談中、進行中、封存；沒有專案的狀態也保留空組。 */
export function projectsByStatus(projects: Project[]): { status: ProjectStatus; projects: Project[] }[] {
  return PROJECT_STATUSES.map((status) => ({ status, projects: projects.filter((p) => p.status === status) }));
}

/**
 * 沒人負責的需求條目：沒指定負責課程，或指定的課程不存在、不屬於這個專案。
 * courses 由呼叫端傳入（設計稿傳 COURSES）。
 */
export function unassignedRequirements(project: Project, courses: Course[]): Requirement[] {
  const own = new Set(courses.filter((c) => c.projectId === project.id).map((c) => c.id));
  return project.requirements.filter((r) => r.courseId === null || !own.has(r.courseId));
}

export interface RequirementMappingRow {
  requirement: Requirement;
  /** 字面與時數：由 mapRequirements 計算 */
  mapping: RequirementMapping;
  /** 實質涵蓋：設計稿的 fixture 標註；沒標註則為 null */
  review: RequirementReview | null;
}

/** 課程頁的需求對照：這門課負責的需求條目，依專案裡的順序逐條比對最新藍圖。 */
export function requirementMappingOfCourse(course: Course): RequirementMappingRow[] {
  const requirements = getProject(course.projectId)?.requirements.filter((r) => r.courseId === course.id) ?? [];
  const mappings = mapRequirements(course.blueprint, requirements);
  return requirements.map((requirement, i) => ({
    requirement,
    mapping: mappings[i],
    review: REQUIREMENT_REVIEWS.find((r) => r.requirementId === requirement.id) ?? null,
  }));
}
