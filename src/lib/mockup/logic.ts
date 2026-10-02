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
  ARTIFACT_LABELS,
  PROJECT_STATUSES,
  type Artifact,
  type ArtifactKind,
  type ClientDocument,
  type Course,
  type Framework,
  type IsoTime,
  type Link,
  type Material,
  type Project,
  type ProjectStatus,
  type Publication,
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
  SESSIONS.filter((s) => s.courseId === courseId).sort((a, b) => ms(sessionStartsAt(a)) - ms(sessionStartsAt(b)));

export const latestFrameworkVersion = (f: Framework) =>
  Math.max(...f.versions.map((v) => v.version));

export const frameworksOfTopic = (topicId: string) =>
  FRAMEWORKS.filter((f) => f.topicId === topicId);

export const pendingDrafts = () => KNOWLEDGE_DRAFTS;

// ── 藍圖與產物 ────────────────────────────────────────

export const latestBlueprintVersion = (course: Course) =>
  Math.max(...course.blueprintHistory.map((v) => v.version));

/** 產物的一個系列：同一種類（逐頁腳本與簡報再加上同一天）的所有版本是同一份產物。 */
export interface ArtifactSeries {
  kind: ArtifactKind;
  /** 逐頁腳本與簡報是第幾天；其他為 null */
  day: number | null;
}

/** 「第 1 天簡報」「學員手冊」；用詞和藍圖面板的「第 N 天」一致。 */
export const seriesLabel = ({ kind, day }: ArtifactSeries) =>
  day === null ? ARTIFACT_LABELS[kind] : `第 ${day} 天${ARTIFACT_LABELS[kind]}`;

/** 依藍圖的天數，列出這門課程應有的整條產物鏈，依鏈的順序排列。 */
export function artifactSeries(course: Course): ArtifactSeries[] {
  const days = course.blueprint.days.map((_, i) => i + 1);
  return [
    { kind: "outline", day: null },
    { kind: "prep_sheet", day: null },
    ...days.flatMap((day): ArtifactSeries[] => [
      { kind: "page_script", day },
      { kind: "slides", day },
    ]),
    { kind: "handbook", day: null },
  ];
}

/** 某一份產物目前最新的一版；還沒產過則為 undefined。逐頁腳本與簡報要給第幾天。 */
export function latestArtifact(course: Course, kind: ArtifactKind, day: number | null = null): Artifact | undefined {
  return course.artifacts
    .filter((a) => a.kind === kind && a.day === day)
    .sort((a, b) => b.version - a.version)[0];
}

/** 同一份產物最新的「可用」版本（status 為 ready）；還在產或產失敗的新版不算。 */
export function latestReadyArtifact(course: Course, kind: ArtifactKind, day: number | null = null): Artifact | undefined {
  return course.artifacts
    .filter((a) => a.kind === kind && a.day === day && a.status === "ready")
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

/** 同一份產物（同種類、同一天）的所有版本，新的在前。 */
export const artifactVersions = (course: Course, series: ArtifactSeries) =>
  course.artifacts
    .filter((a) => a.kind === series.kind && a.day === series.day)
    .sort((a, b) => b.version - a.version);

export type StaleReason =
  | { kind: "blueprint"; latestVersion: number }
  | { kind: "upstream"; artifact: ArtifactKind; day: number | null; latestVersion: number }
  | { kind: "upstream_stale"; artifact: ArtifactKind; day: number | null };

/**
 * 產物為什麼過期（ADR 0003）：綁定的藍圖不是最新版，或任一上游產物版本不是該上游的最新版。
 * 上游一旦有更新的可用版本（ready），下游就過期，所以過期會沿著鏈往下傳；還在產或產失敗的新版不算。空陣列代表沒有過期。
 */
export function staleReasons(course: Course, artifact: Artifact): StaleReason[] {
  const reasons: StaleReason[] = [];
  const latestBp = latestBlueprintVersion(course);
  if (artifact.blueprintVersion < latestBp) reasons.push({ kind: "blueprint", latestVersion: latestBp });
  for (const id of artifact.upstreamIds) {
    const upstream = course.artifacts.find((a) => a.id === id);
    if (!upstream) throw new Error(`產物 ${artifact.id} 的上游 ${id} 不在課程 ${course.id}`);
    const latest = latestReadyArtifact(course, upstream.kind, upstream.day);
    if (latest && latest.version > upstream.version) {
      reasons.push({ kind: "upstream", artifact: upstream.kind, day: upstream.day, latestVersion: latest.version });
    } else if (staleReasons(course, upstream).length > 0) {
      // 上游本身已過期（例如它還綁著舊藍圖），從它長出來的下游也不可信
      reasons.push({ kind: "upstream_stale", artifact: upstream.kind, day: upstream.day });
    }
  }
  return reasons;
}

export const isStale = (course: Course, artifact: Artifact) => staleReasons(course, artifact).length > 0;

export function staleReasonText(reason: StaleReason): string {
  if (reason.kind === "blueprint") return `藍圖已到 v${reason.latestVersion}`;
  const label = seriesLabel({ kind: reason.artifact, day: reason.day });
  return reason.kind === "upstream" ? `${label}已到 v${reason.latestVersion}` : `${label}已過期`;
}

// ── 定稿閘 ────────────────────────────────────────────

/** 產檔工作被擋住的原因：缺哪一步定稿。 */
export type GateBlock =
  | { kind: "blueprint_not_finalized"; version: number }
  /** 那天沒有可用（ready）的逐頁腳本：還沒產，或還在產、產失敗 */
  | { kind: "script_missing"; day: number }
  | { kind: "script_not_finalized"; day: number; version: number }
  | { kind: "script_stale"; day: number; version: number };

/** 某一天最新可用的逐頁腳本能不能當下游的上游：要定稿、而且沒過期。 */
function scriptBlock(course: Course, day: number): GateBlock | null {
  const script = latestReadyArtifact(course, "page_script", day);
  if (!script) return { kind: "script_missing", day };
  if (script.finalizedAt === null) return { kind: "script_not_finalized", day, version: script.version };
  if (isStale(course, script)) return { kind: "script_stale", day, version: script.version };
  return null;
}

/**
 * 定稿閘：某個產檔工作現在能不能排。空陣列代表可以排。
 * 「最新」一律指最新的可用版本（ready）；還在產或產失敗的新版不算。
 * - 逐頁腳本：藍圖最新版已定稿。
 * - 某天簡報：該天最新可用的逐頁腳本已定稿、沒過期。
 * - 學員手冊：藍圖每一天最新可用的逐頁腳本都已定稿、沒過期；每一天的問題都列出。
 * - 課程大綱、講師準備單：不設閘。
 * 天數不在藍圖範圍內、或整門課一份的產物帶了天，是呼叫端的錯，直接丟例外。
 */
export function generationGate(course: Course, job: ArtifactSeries): GateBlock[] {
  const perDay = job.kind === "page_script" || job.kind === "slides";
  const validDay = perDay
    ? job.day !== null && Number.isInteger(job.day) && job.day >= 1 && job.day <= course.blueprint.days.length
    : job.day === null;
  if (!validDay) throw new Error(`課程 ${course.id} 沒有「${ARTIFACT_LABELS[job.kind]}・第 ${job.day} 天」這個產檔工作`);

  switch (job.kind) {
    case "outline":
    case "prep_sheet":
      return [];
    case "page_script": {
      const latest = course.blueprintHistory.find((v) => v.version === latestBlueprintVersion(course))!;
      return latest.finalizedAt === null ? [{ kind: "blueprint_not_finalized", version: latest.version }] : [];
    }
    case "slides": {
      const block = scriptBlock(course, job.day!);
      return block ? [block] : [];
    }
    case "handbook":
      return course.blueprint.days
        .map((_, i) => scriptBlock(course, i + 1))
        .filter((b): b is GateBlock => b !== null);
  }
}

export function gateBlockText(block: GateBlock): string {
  if (block.kind === "blueprint_not_finalized") return `藍圖 v${block.version} 還沒定稿`;
  const label = seriesLabel({ kind: "page_script", day: block.day });
  switch (block.kind) {
    case "script_missing":
      return `${label}還沒有可用的版本`;
    case "script_not_finalized":
      return `${label} v${block.version} 還沒定稿`;
    case "script_stale":
      return `${label} v${block.version} 已過期，要先重產並定稿`;
  }
}

/**
 * 講師把某個版本改過再上傳：成為同一份產物的下一版（排在目前最新版之後），
 * 沿用原版本的藍圖與上游綁定，所以過期與否跟著原本的綁定走。
 */
export function instructorEdit(course: Course, baseId: string, upload: { id: string; createdAt: IsoTime }): Artifact {
  const original = course.artifacts.find((a) => a.id === baseId);
  if (!original) throw new Error(`課程 ${course.id} 沒有產物 ${baseId}`);
  const latest = latestArtifact(course, original.kind, original.day)!;
  return {
    id: upload.id,
    kind: original.kind,
    day: original.day,
    version: latest.version + 1,
    blueprintVersion: original.blueprintVersion,
    upstreamIds: [...original.upstreamIds],
    editedFromId: original.id,
    sentToClientAt: null,
    finalizedAt: null,
    status: "ready",
    createdAt: upload.createdAt,
  };
}

/** 講師準備單是內部文件，永遠不會發布給學員。 */
export const isPublishable = (artifact: Pick<Artifact, "kind">) => artifact.kind !== "prep_sheet";

export type PublicationProblem =
  | { kind: "not_publishable"; artifactId: string }
  | { kind: "foreign_artifact"; artifactId: string }
  | { kind: "foreign_material"; materialId: string };

/** 一次發布有什麼不允許的內容：講師準備單、或不屬於這門課程的產物與素材。空陣列代表可以發布。 */
export function publicationProblems(
  course: Course,
  publication: Pick<Publication, "artifactIds" | "materialIds">,
): PublicationProblem[] {
  const problems: PublicationProblem[] = [];
  for (const id of publication.artifactIds) {
    const a = course.artifacts.find((x) => x.id === id);
    if (!a) problems.push({ kind: "foreign_artifact", artifactId: id });
    else if (!isPublishable(a)) problems.push({ kind: "not_publishable", artifactId: id });
  }
  for (const id of publication.materialIds) {
    if (!course.materials.some((m) => m.id === id)) problems.push({ kind: "foreign_material", materialId: id });
  }
  return problems;
}

// ── 準備度 ────────────────────────────────────────────

export type ReadinessItem =
  /** 藍圖的待確認事項（openItems），含未確認的工具；tools 是其中幾個是工具 */
  | { kind: "open_items"; count: number; tools: number }
  | { kind: "missing_elements"; labels: string[] }
  /** 時段裡單元分鐘數加總和時段長度對不上 */
  | { kind: "duration_mismatch"; slots: { day: number; slotLabel: string; planned: number; expected: number }[] }
  | { kind: "units_need_work"; modify: number; new: number }
  /** 需求對照的缺口：⚠️（只部分涵蓋）與 ❌（字面上找不到）的需求條目原文，依需求對照的順序 */
  | { kind: "requirement_gaps"; partial: string[]; notFound: string[] }
  /** 還沒有可用（ready）的版本：沒產過，或只有還在產、產失敗的版本 */
  | { kind: "artifact_missing"; artifact: ArtifactKind; day: number | null }
  /** 某天最新可用的逐頁腳本還沒定稿 */
  | { kind: "script_not_finalized"; day: number; version: number }
  /** 最新可用的版本沿鏈過期（staleReasons） */
  | { kind: "artifact_stale"; artifact: ArtifactKind; day: number | null; version: number; reasons: StaleReason[] }
  | { kind: "day_count_mismatch"; sessionDays: number; blueprintDays: number }
  | { kind: "venue_unset"; days: number[]; totalDays: number }
  | { kind: "no_materials" }
  | { kind: "no_links" }
  | { kind: "unpublished" }
  | { kind: "publication_outdated"; artifacts: ArtifactSeries[] };

/**
 * 一個場次距離可以上課還缺哪些事（#25 user story 48）。空陣列代表準備好了。
 * 「最新」一律指最新的可用版本（ready），和定稿閘一致。
 * 純講述單元（lecture_only）是設計上的提醒、不是缺項，所以不列。
 * course 預設依場次查；測試可傳入改過的課程。
 */
export function readiness(session: Session, course: Course | undefined = getCourse(session.courseId)): ReadinessItem[] {
  if (!course) throw new Error(`場次 ${session.id} 找不到課程 ${session.courseId}`);
  const bp = course.blueprint;
  const items: ReadinessItem[] = [];

  // 藍圖
  const open = openItems(bp);
  if (open.length > 0) {
    items.push({ kind: "open_items", count: open.length, tools: open.filter((i) => i.tool !== null).length });
  }
  const missing = missingElements(bp);
  if (missing.length > 0) {
    items.push({ kind: "missing_elements", labels: missing.map((k) => FIVE_ELEMENT_LABELS[k]) });
  }
  const slots = checkBlueprint(bp).flatMap((issue) =>
    issue.kind === "duration_mismatch"
      ? [{ day: issue.day, slotLabel: bp.days[issue.day - 1].slots[issue.slot - 1].label, planned: issue.planned, expected: issue.expected }]
      : [],
  );
  if (slots.length > 0) items.push({ kind: "duration_mismatch", slots });
  const work = unitWorkCounts(bp);
  if (work.modify + work.new > 0) items.push({ kind: "units_need_work", ...work });

  // 需求對照：和課程頁的 ✅／⚠️／❌ 用同一個判斷（mapping.status）
  const rows = requirementMappingOfCourse(course);
  const textsOf = (status: RequirementMapping["status"]) =>
    rows.filter((r) => r.mapping.status === status).map((r) => r.requirement.text);
  const gaps = { partial: textsOf("partial"), notFound: textsOf("not_found") };
  if (gaps.partial.length + gaps.notFound.length > 0) items.push({ kind: "requirement_gaps", ...gaps });

  // 產物：沿著鏈的順序
  for (const { kind, day } of artifactSeries(course)) {
    const a = latestReadyArtifact(course, kind, day);
    if (!a) {
      items.push({ kind: "artifact_missing", artifact: kind, day });
      continue;
    }
    if (kind === "page_script" && a.finalizedAt === null) {
      items.push({ kind: "script_not_finalized", day: day!, version: a.version });
    }
    const reasons = staleReasons(course, a);
    if (reasons.length > 0) items.push({ kind: "artifact_stale", artifact: kind, day, version: a.version, reasons });
  }

  // 場次安排
  const mismatch = sessionDayCountMismatch(session, bp);
  if (mismatch) items.push({ kind: "day_count_mismatch", ...mismatch });
  const noVenue = session.days.flatMap((d, i) => (d.venue === null ? [i + 1] : []));
  if (noVenue.length > 0) items.push({ kind: "venue_unset", days: noVenue, totalDays: session.days.length });

  // 給學員的東西
  if (course.materials.length === 0) items.push({ kind: "no_materials" });
  if (session.links.length === 0) items.push({ kind: "no_links" });
  if (!session.publication) {
    items.push({ kind: "unpublished" });
  } else {
    // 只看這個場次已經發布過的產物有沒有更新的版本；哪些產物該給學員看是 #35 的事
    const pinned = course.artifacts.filter((a) => session.publication!.artifactIds.includes(a.id));
    const outdated = artifactSeries(course).filter(({ kind, day }) => {
      if (!pinned.some((a) => a.kind === kind && a.day === day)) return false;
      const latest = latestArtifact(course, kind, day);
      return latest && latest.status === "ready" && !pinned.includes(latest);
    });
    if (outdated.length > 0) items.push({ kind: "publication_outdated", artifacts: outdated });
  }
  return items;
}

const countText = (parts: [number, string][]) =>
  parts
    .filter(([n]) => n > 0)
    .map(([n, label]) => `${n} ${label}`)
    .join("、");

export function readinessText(item: ReadinessItem): string {
  switch (item.kind) {
    case "open_items":
      return `藍圖還有 ${item.count} 個待確認事項${item.tools > 0 ? `（含 ${item.tools} 個未確認的工具）` : ""}`;
    case "missing_elements":
      return `藍圖缺五元素：${item.labels.join("、")}`;
    case "duration_mismatch":
      return item.slots
        .map((s) => `第 ${s.day} 天${s.slotLabel}單元排了 ${s.planned} 分鐘，時段是 ${s.expected} 分鐘`)
        .join("；");
    case "units_need_work":
      return `還有 ${countText([
        [item.modify, "個單元要改"],
        [item.new, "個單元要新做"],
      ])}`;
    case "requirement_gaps":
      return `需求對照有 ${countText([
        [item.notFound.length, "條在藍圖裡找不到"],
        [item.partial.length, "條只部分涵蓋"],
      ])}`;
    case "artifact_missing":
      return `還沒有可用的${seriesLabel({ kind: item.artifact, day: item.day })}`;
    case "script_not_finalized":
      return `${seriesLabel({ kind: "page_script", day: item.day })} v${item.version} 還沒定稿`;
    case "artifact_stale":
      return `${seriesLabel({ kind: item.artifact, day: item.day })} v${item.version} 已過期：${item.reasons.map(staleReasonText).join("、")}`;
    case "day_count_mismatch":
      return `場次排了 ${item.sessionDays} 天，藍圖是 ${item.blueprintDays} 天`;
    case "venue_unset":
      return item.totalDays === 1
        ? "地點還沒定"
        : `${item.days.map((d) => `第 ${d} 天`).join("、")}地點還沒定`;
    case "no_materials":
      return "還沒上傳素材";
    case "no_links":
      return "還沒填 Slido 等連結";
    case "unpublished":
      return "還沒發布給學員";
    case "publication_outdated":
      return `有較新的${item.artifacts.map(seriesLabel).join("、")}還沒發布`;
  }
}

/** 準備度缺項的來源，依畫面上的顯示順序。 */
export const READINESS_SOURCES = [
  { source: "blueprint", label: "藍圖" },
  { source: "requirements", label: "需求對照" },
  { source: "artifacts", label: "產物" },
  { source: "session", label: "場次安排" },
  { source: "publication", label: "給學員的東西" },
] as const;
export type ReadinessSource = (typeof READINESS_SOURCES)[number]["source"];

const SOURCE_OF: Record<ReadinessItem["kind"], ReadinessSource> = {
  open_items: "blueprint",
  missing_elements: "blueprint",
  duration_mismatch: "blueprint",
  units_need_work: "blueprint",
  requirement_gaps: "requirements",
  artifact_missing: "artifacts",
  script_not_finalized: "artifacts",
  artifact_stale: "artifacts",
  day_count_mismatch: "session",
  venue_unset: "session",
  no_materials: "publication",
  no_links: "publication",
  unpublished: "publication",
  publication_outdated: "publication",
};

/** 把準備度缺項依來源分組，順序固定（READINESS_SOURCES）；沒有缺項的來源不出現。 */
export function readinessGroups(
  items: ReadinessItem[],
): { source: ReadinessSource; label: string; items: ReadinessItem[] }[] {
  return READINESS_SOURCES.map(({ source, label }) => ({
    source,
    label,
    items: items.filter((i) => SOURCE_OF[i.kind] === source),
  })).filter((g) => g.items.length > 0);
}

/** 講師首頁：還沒結束的場次（最後一天還沒上完），依第一天開始時間排序。 */
export function upcomingSessions(now: IsoTime): Session[] {
  return SESSIONS.filter((s) => ms(sessionEndsAt(s)) >= ms(now)).sort(
    (a, b) => ms(sessionStartsAt(a)) - ms(sessionStartsAt(b)),
  );
}

// ── 場次 ──────────────────────────────────────────────

/** 場次第一天的開始時間 */
export const sessionStartsAt = (session: Pick<Session, "days">): IsoTime => session.days[0].startsAt;
/** 場次最後一天的結束時間 */
export const sessionEndsAt = (session: Pick<Session, "days">): IsoTime => session.days[session.days.length - 1].endsAt;

/**
 * 場次的天數必須等於藍圖的天數（場次的每一天一對一對應藍圖的天；時程不同的版本另開一門課程）。
 * 相符回傳 null。
 */
export function sessionDayCountMismatch(
  session: Pick<Session, "days">,
  blueprint: Blueprint,
): { sessionDays: number; blueprintDays: number } | null {
  const sessionDays = session.days.length;
  const blueprintDays = blueprint.days.length;
  return sessionDays === blueprintDays ? null : { sessionDays, blueprintDays };
}

// ── 學員入口 ──────────────────────────────────────────

/** 台灣時間的日曆日期，"2026-10-20"；字串可直接比大小。 */
const taipeiDate = (t: IsoTime) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(t),
  );

/**
 * 學員入口現在要顯示場次的第幾天（從 1 起算），以台灣時間的日期判斷：
 * - 今天是場次的某一天 → 那一天（整天都是，下課後也還是，方便學員當晚複習）
 * - 第一天之前、或兩天之間 → 下一個要上的那天
 * - 最後一天之後 → 最後一天
 */
export function portalDay(session: Pick<Session, "days">, now: IsoTime): number {
  const today = taipeiDate(now);
  const dates = session.days.map((d) => taipeiDate(d.startsAt));
  const upcoming = dates.findIndex((date) => date >= today);
  return upcoming === -1 ? dates.length : upcoming + 1;
}

export function portalExpiresAt(session: Session): IsoTime {
  return (
    session.portal.expiresAtOverride ??
    new Date(ms(sessionEndsAt(session)) + PORTAL_VALID_DAYS * DAY_MS).toISOString()
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
 * 產物只給「今天」（portalDay）那一天的（簡報），加上整門課一份的（學員手冊等）。
 */
export interface PortalView {
  state: PortalState;
  courseTitle: string;
  /** 現在顯示的是第幾天（portalDay） */
  day: number;
  /** 每一天的日期、時間與地點 */
  days: { day: number; startsAt: IsoTime; endsAt: IsoTime; venue: string | null }[];
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
  const day = portalDay(session, now);

  return {
    state,
    courseTitle: course.title,
    day,
    days: session.days.map((d, i) => ({ day: i + 1, startsAt: d.startsAt, endsAt: d.endsAt, venue: d.venue })),
    expiresAt: portalExpiresAt(session),
    artifacts: pub
      ? course.artifacts
          .filter((a) => pub.artifactIds.includes(a.id) && (a.day === null || a.day === day))
          .map((a) => ({ id: a.id, label: seriesLabel(a), version: a.version }))
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

/** 場次的日期：單天「10月15日 週四」，多天「10月20日 週二–10月27日 週二」 */
export function sessionDateRange(session: Pick<Session, "days">): string {
  const first = formatDate(sessionStartsAt(session));
  const last = formatDate(session.days[session.days.length - 1].startsAt);
  return first === last ? first : `${first}–${last}`;
}

/** 一天的日期與時間：「10月20日 週二 09:00–16:00」 */
export const dayTimeText = (d: { startsAt: IsoTime; endsAt: IsoTime }) =>
  `${formatDate(d.startsAt)} ${formatTime(d.startsAt)}–${formatTime(d.endsAt)}`;

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

/** 回應某一版課程大綱的客戶回饋（客戶文件的 respondsToOutlineId）。 */
export function outlineFeedback(project: Project, outlineId: string): ClientDocument[] {
  return project.clientDocuments.filter((d) => d.kind === "feedback" && d.respondsToOutlineId === outlineId);
}
