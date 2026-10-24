import { coursesOfProject, seriesLabel, sessionEndsAt, sessionsOfCourse } from "./logic";
import type { DemoState } from "./state";
import type { Artifact, Course, IsoTime } from "./types";

/**
 * 結案閘與結案狀態（#59）。純函式，不碰 UI；結案動作在 actions.ts 的 course/close。
 * 最終版（GLOSSARY）：課後由講師上傳、代表實際上課內容的逐頁腳本或簡報版本。
 * 它和定稿不同：定稿是產下游之前的認可，最終版是課上實際用過的版本。
 */

/** 結案要有最終版的產物種類 */
export const FINAL_KINDS = ["page_script", "slides"] as const;
export type FinalKind = (typeof FINAL_KINDS)[number];

export interface MissingFinal {
  kind: FinalKind;
  /** 第幾天 */
  day: number;
}

export interface ClosingGate {
  /** 缺最終版的天與產物種類，依天數、逐頁腳本在前簡報在後排列 */
  missingFinals: MissingFinal[];
  /** 這門課程有沒有任何場次；沒有場次代表還沒上過課，不能結案 */
  hasSessions: boolean;
  /** 還沒結束（最後一天的結束時間在 now 之後）的場次 id */
  unfinishedSessionIds: string[];
  canClose: boolean;
}

/**
 * 該天該種類有沒有最終版：同一份產物裡任何一版是講師上傳的（editedFromId 不為 null）。
 * AI 產的版本就算沒改過，也要講師重新上傳一次才算數。
 */
function hasFinal(course: Course, kind: FinalKind, day: number): boolean {
  return course.artifacts.some((a) => a.kind === kind && a.day === day && a.editedFromId !== null);
}

/**
 * 各天各種類的最終版：同一份產物裡講師上傳（editedFromId 不為 null）的最新一版。
 * 依天數排列、逐頁腳本在前簡報在後；沒有講師上傳版本的那一份不出現。
 */
export function finalArtifacts(course: Course): Artifact[] {
  return course.blueprint.days.flatMap((_, i) =>
    FINAL_KINDS.flatMap((kind) => {
      const uploads = course.artifacts.filter((a) => a.kind === kind && a.day === i + 1 && a.editedFromId !== null);
      const latest = uploads.reduce<Artifact | undefined>((best, a) => (best === undefined || a.version > best.version ? a : best), undefined);
      return latest ? [latest] : [];
    }),
  );
}

export function closingGate(st: DemoState, course: Course, now: IsoTime): ClosingGate {
  const missingFinals = course.blueprint.days.flatMap((_, i): MissingFinal[] =>
    FINAL_KINDS.filter((kind) => !hasFinal(course, kind, i + 1)).map((kind) => ({ kind, day: i + 1 })),
  );
  const sessions = sessionsOfCourse(st, course.id);
  const unfinishedSessionIds = sessions.filter((s) => Date.parse(sessionEndsAt(s)) > Date.parse(now)).map((s) => s.id);
  const hasSessions = sessions.length > 0;
  return {
    missingFinals,
    hasSessions,
    unfinishedSessionIds,
    canClose: missingFinals.length === 0 && hasSessions && unfinishedSessionIds.length === 0,
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
  ];
}

export const closingGateText = (gate: ClosingGate): string => closingGateReasons(gate).join("；");

export const isCourseClosed = (course: Pick<Course, "closedAt">): boolean => course.closedAt !== null;

/**
 * 專案結案不另存，由底下的課程全部結案推得；PROJECT_STATUSES 不變（封存仍然只代表沒成交）。
 * 沒有任何課程的專案不算結案：還沒有東西可以收尾。
 */
export function isProjectClosed(st: DemoState, projectId: string): boolean {
  const courses = coursesOfProject(st, projectId);
  return courses.length > 0 && courses.every(isCourseClosed);
}
