import { coursesOfProject, isHandsOnDay, seriesLabel, sessionEndsAt, sessionsOfCourse } from "./logic";
import type { DemoState } from "./state";
import type { DemoAction } from "./actions";
import type { Artifact, ArtifactKind, Course, IsoTime, KnowledgeDraft, Project, ProjectStatus } from "./types";

/**
 * 結案閘與結案狀態（#59）。純函式，不碰 UI；結案動作在 actions.ts 的 course/close。
 * 最終版（GLOSSARY）：課後由講師上傳、代表實際上課內容的版本（講稿在簡報備忘稿裡，不另算）。
 * 每一天都要有簡報的最終版；有動手環節的天另外要有學員手冊的最終版（#107，ADR 0005）。
 * 結案也要這門課沒有進行中（pending、generating）的工作，避免結案後才有新版本掉進來。
 * 它和定稿不同：定稿是產下游之前的認可，最終版是課上實際用過的版本。
 */

/** 結案要有最終版的產物種類 */
export const FINAL_KINDS = ["slides", "handbook"] as const;
export type FinalKind = (typeof FINAL_KINDS)[number];

/**
 * 某一天結案要有最終版的產物種類，簡報在前：每天都要簡報，有動手環節（isHandsOnDay）的天另外要學員手冊。
 * 「哪一天需要哪些最終版」只在這裡決定，結案閘與最終版清單共用。
 */
export function requiredFinalKinds(course: Course, day: number): FinalKind[] {
  return FINAL_KINDS.filter((kind) => kind === "slides" || isHandsOnDay(course, day));
}

export interface MissingFinal {
  kind: FinalKind;
  /** 第幾天 */
  day: number;
}

export interface ClosingGate {
  /** 缺最終版的天與產物種類，依天數排列 */
  missingFinals: MissingFinal[];
  /** 這門課程有沒有任何場次；沒有場次代表還沒上過課，不能結案 */
  hasSessions: boolean;
  /** 還沒結束（最後一天的結束時間在 now 之後）的場次 id */
  unfinishedSessionIds: string[];
  /** 還在排隊或產出中（pending、generating）的工作；進行中的工作做完前不能結案 */
  activeJobs: { kind: ArtifactKind; day: number | null }[];
  canClose: boolean;
}

/**
 * 該天該種類的最終版：同一份產物裡講師上傳（editedFromId 不為 null）的最新一版；沒有則為 undefined。
 * AI 產的版本就算沒改過，也要講師重新上傳一次才算數。最終版的判斷只有這一處。
 */
function latestFinal(course: Course, kind: FinalKind, day: number): Artifact | undefined {
  const uploads = course.artifacts.filter((a) => a.kind === kind && a.day === day && a.editedFromId !== null);
  return uploads.reduce<Artifact | undefined>((best, a) => (best === undefined || a.version > best.version ? a : best), undefined);
}

/**
 * 各天的最終版，依天數排列、同一天簡報在前；沒有最終版的那一份不出現。
 * 哪一天要哪些種類由 requiredFinalKinds 決定（簡報每天都算，學員手冊只算有動手環節那天），結案草稿的依據就是它。
 */
export function finalArtifacts(course: Course): Artifact[] {
  return course.blueprint.days.flatMap((_, i) =>
    requiredFinalKinds(course, i + 1).flatMap((kind) => {
      const latest = latestFinal(course, kind, i + 1);
      return latest ? [latest] : [];
    }),
  );
}

export function closingGate(st: DemoState, course: Course, now: IsoTime): ClosingGate {
  const missingFinals = course.blueprint.days.flatMap((_, i): MissingFinal[] =>
    requiredFinalKinds(course, i + 1)
      .filter((kind) => latestFinal(course, kind, i + 1) === undefined)
      .map((kind) => ({ kind, day: i + 1 })),
  );
  const sessions = sessionsOfCourse(st, course.id);
  const unfinishedSessionIds = sessions.filter((s) => Date.parse(sessionEndsAt(s)) > Date.parse(now)).map((s) => s.id);
  const hasSessions = sessions.length > 0;
  const activeJobs = course.artifacts
    .filter((a) => a.status === "pending" || a.status === "generating")
    .map((a) => ({ kind: a.kind, day: a.day }));
  return {
    missingFinals,
    hasSessions,
    unfinishedSessionIds,
    activeJobs,
    canClose: missingFinals.length === 0 && hasSessions && unfinishedSessionIds.length === 0 && activeJobs.length === 0,
  };
}

/** 結案閘擋住的原因，一條一句；全部齊了則為空陣列。 */
export function closingGateReasons(gate: ClosingGate): string[] {
  return [
    ...(gate.missingFinals.length > 0
      ? [`還缺最終版：${gate.missingFinals.map((m) => seriesLabel({ kind: m.kind, day: m.day })).join("、")}`]
      : []),
    ...(!gate.hasSessions ? ["還沒有任何場次"] : []),
    ...(gate.unfinishedSessionIds.length > 0 ? [`還有 ${gate.unfinishedSessionIds.length} 個場次沒結束`] : []),
    ...(gate.activeJobs.length > 0
      ? [`還有 ${gate.activeJobs.length} 個工作沒做完：${gate.activeJobs.map((j) => seriesLabel(j)).join("、")}`]
      : []),
  ];
}

export const isCourseClosed = (course: Pick<Course, "closedAt">): boolean => course.closedAt !== null;

/**
 * 結案後凍結的操作（#77）：不能新增或修改場次（含日期、連結；發布不凍結，見下）、不能要求／上傳／定稿／寄出產物、
 * 不能修改或定稿藍圖、不能增減素材、不能改標籤。仍可做的：查看與下載、發布場次、管理學員入口（portal/*）。
 * 發布（session/publish）只是把已經 ready 的版本交給學員、不改課程內容；最終版手冊又是課後才上傳，凍結發布會讓學員拿不到最終版。
 * artifact/advance 是 demo 裡「講師端 plugin 把排隊的工作做完」的替身，不是講師的操作，不凍結。
 * 「這個操作對這門課程是不是凍結了」只在 isFrozenByClosing 判斷，reducer 與畫面共用。
 */
export const FROZEN_AFTER_CLOSING = [
  "session/create",
  "session/updateDays",
  "link/add",
  "link/remove",
  "artifact/request",
  "artifact/uploadEdit",
  "artifact/finalize",
  "artifact/markSent",
  "blueprint/revise",
  "blueprint/finalize",
  "material/add",
  "material/remove",
  "course/updateTags",
] as const satisfies readonly DemoAction["type"][];

/** 畫面上停用凍結操作時的簡短理由 */
export const CLOSED_FROZEN_REASON = "已結案，不能修改";

export function isFrozenByClosing(course: Pick<Course, "closedAt"> | undefined, actionType: DemoAction["type"]): boolean {
  return course !== undefined && isCourseClosed(course) && (FROZEN_AFTER_CLOSING as readonly string[]).includes(actionType);
}

/** 重新開啟會撤回的草稿：這門課程結案時產生、還在待審的（已接受的草稿早就不在待審清單裡）。 */
export const reopenWithdrawals = (st: DemoState, courseId: string): KnowledgeDraft[] =>
  st.drafts.filter((d) => d.fromCourseId === courseId && d.trigger === "closing");

/**
 * 專案結案不另存，由底下的課程全部結案推得；PROJECT_STATUSES 不變（封存仍然只代表沒成交）。
 * 沒有任何課程的專案不算結案：還沒有東西可以收尾。
 */
export function isProjectClosed(st: DemoState, projectId: string): boolean {
  const courses = coursesOfProject(st, projectId);
  return courses.length > 0 && courses.every(isCourseClosed);
}

/** 專案列表的分組：狀態三組之外，推得的結案獨立一組，不混在進行中底下。 */
export type ProjectGroupKey = ProjectStatus | "closed";

/**
 * 專案列表分組，順序固定為洽談中、進行中、已結案、封存；沒有專案的組也保留。
 * 已結案是推得的（isProjectClosed）：進行中而且課程全部結案的專案歸這一組；封存只代表沒成交，不受結案影響。
 */
export function projectGroups(st: DemoState, projects: Project[]): { key: ProjectGroupKey; projects: Project[] }[] {
  const closed = (p: Project) => p.status === "active" && isProjectClosed(st, p.id);
  return [
    { key: "negotiating", projects: projects.filter((p) => p.status === "negotiating") },
    { key: "active", projects: projects.filter((p) => p.status === "active" && !closed(p)) },
    { key: "closed", projects: projects.filter(closed) },
    { key: "archived", projects: projects.filter((p) => p.status === "archived") },
  ];
}
