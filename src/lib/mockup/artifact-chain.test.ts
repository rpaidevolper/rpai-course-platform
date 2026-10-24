import { describe, expect, it } from "vitest";
import { getCourse, getProject, instructorEdit, isStale, outlineFeedback, publicationProblems, staleReasons } from "./logic";
import type { Artifact, Course } from "./types";
import { initialState } from "./state";

const st = initialState();

/**
 * 產物鏈（ADR 0005）：藍圖 → 課程大綱、講師準備單；藍圖 → 簡報（每天，講稿在備忘稿裡）→ 那天的學員手冊（只給含動手環節的天）。
 * 每個測試自己組一份兩天課程的快照，不依賴 fixture 示範的狀態。
 */

const base = getCourse(st, "c-gas-two-day")!;

function v(a: Pick<Artifact, "id" | "kind"> & Partial<Artifact>): Artifact {
  return {
    day: null,
    version: 1,
    blueprintVersion: 1,
    upstreamIds: [],
    editedFromId: null,
    sentToClientAt: null,
    finalizedAt: null,
    status: "ready",
    createdAt: "2026-10-01T10:00:00+08:00",
    ...a,
  };
}

/** 全部出自藍圖 v1、彼此綁定最新上游的一條完整產物鏈：每天一份簡報、每天一份學員手冊（兩天都有動手環節）。 */
const FRESH: Artifact[] = [
  v({ id: "outline-1", kind: "outline" }),
  v({ id: "prep-1", kind: "prep_sheet" }),
  v({ id: "d1-slides-1", kind: "slides", day: 1 }),
  v({ id: "d2-slides-1", kind: "slides", day: 2 }),
  v({ id: "d1-handbook-1", kind: "handbook", day: 1, upstreamIds: ["d1-slides-1"] }),
  v({ id: "d2-handbook-1", kind: "handbook", day: 2, upstreamIds: ["d2-slides-1"] }),
];

function snapshot(artifacts: Artifact[], blueprintVersions = [1]): Course {
  return {
    ...base,
    blueprintHistory: blueprintVersions.map((version) => ({ version, createdAt: "2026-09-30T10:00:00+08:00", note: "", finalizedAt: null })),
    artifacts,
  };
}

const staleIds = (course: Course) =>
  course.artifacts
    .filter((a) => isStale(course, a))
    .map((a) => a.id)
    .sort();

describe("過期沿產物鏈傳遞", () => {
  it("整條鏈都綁最新版本時，沒有產物過期", () => {
    expect(staleIds(snapshot(FRESH))).toEqual([]);
  });

  it("上游本身已過期：藍圖 v2 時只重產了第 1 天手冊，它的簡報還是藍圖 v1，手冊也算過期", () => {
    const course = snapshot(
      FRESH.map((a) => (a.id === "d1-handbook-1" ? { ...a, blueprintVersion: 2 } : a)),
      [1, 2],
    );
    const handbook = course.artifacts.find((a) => a.id === "d1-handbook-1")!;
    expect(staleReasons(course, handbook)).toEqual([{ kind: "upstream_stale", artifact: "slides", day: 1 }]);
    expect(staleIds(course)).toContain("d1-handbook-1");
  });

  it.each(["pending", "generating", "failed"] as const)("上游新版還是 %s：還不是可用版本，下游不算過期", (status) => {
    const course = snapshot([...FRESH, v({ id: "d1-slides-2", kind: "slides", day: 1, version: 2, status })]);
    expect(staleIds(course)).toEqual([]);
  });

  it("藍圖升版：簡報、學員手冊，以及課程大綱與講師準備單全部過期", () => {
    expect(staleIds(snapshot(FRESH, [1, 2]))).toEqual([
      "d1-handbook-1",
      "d1-slides-1",
      "d2-handbook-1",
      "d2-slides-1",
      "outline-1",
      "prep-1",
    ]);
  });

  it("只重產第一天簡報：只有第一天手冊過期，第二天簡報與手冊不受影響", () => {
    const course = snapshot([...FRESH, v({ id: "d1-slides-2", kind: "slides", day: 1, version: 2 })]);
    expect(staleIds(course)).toEqual(["d1-handbook-1"]);
  });

  it("過期原因指出是藍圖還是哪一天的簡報換了新版本", () => {
    const course = snapshot([...FRESH, v({ id: "d1-slides-2", kind: "slides", day: 1, version: 2, blueprintVersion: 2 })], [1, 2]);
    const handbook = course.artifacts.find((a) => a.id === "d1-handbook-1")!;
    expect(staleReasons(course, handbook)).toEqual([
      { kind: "blueprint", latestVersion: 2 },
      { kind: "upstream", artifact: "slides", day: 1, latestVersion: 2 },
    ]);
  });
});

describe("講師修改的版本", () => {
  const upload = { id: "d1-slides-2", createdAt: "2026-10-03T09:00:00+08:00" };

  it("是同一份產物的下一版，沿用原版本的藍圖與上游綁定", () => {
    const course = snapshot(FRESH, [1, 2]);
    const edited = instructorEdit(course, "d1-slides-1", upload);
    expect(edited).toMatchObject({
      id: "d1-slides-2",
      kind: "slides",
      day: 1,
      version: 2,
      blueprintVersion: 1,
      upstreamIds: [],
      editedFromId: "d1-slides-1",
      sentToClientAt: null,
    });
  });

  it("原版本沒過期時它也沒過期；講師上傳修改過的簡報後，那天的手冊過期", () => {
    const course = snapshot(FRESH);
    const withEdit = snapshot([...FRESH, instructorEdit(course, "d1-slides-1", upload)]);
    expect(staleIds(withEdit)).toEqual(["d1-handbook-1"]);
  });

  it("講師修改學員手冊只是手冊的新版本，簡報不受影響", () => {
    const course = snapshot(FRESH);
    const edited = instructorEdit(course, "d1-handbook-1", { id: "d1-handbook-2", createdAt: "2026-10-03T09:00:00+08:00" });
    expect(edited.upstreamIds).toEqual(["d1-slides-1"]);
    expect(staleIds(snapshot([...FRESH, edited]))).toEqual([]);
  });

  it("改的不是最新版也一樣排在最新版之後", () => {
    const course = snapshot([...FRESH, v({ id: "d1-slides-2", kind: "slides", day: 1, version: 2 })]);
    expect(instructorEdit(course, "d1-slides-1", { id: "d1-slides-3", createdAt: upload.createdAt }).version).toBe(3);
  });
});

describe("可發布", () => {
  const pub = (artifactIds: string[], materialIds: string[] = []) => ({
    publishedAt: "2026-10-05T10:00:00+08:00",
    artifactIds,
    materialIds,
    links: [],
  });

  it("講師準備單永遠不可發布", () => {
    expect(publicationProblems(snapshot(FRESH), pub(["d1-slides-1", "prep-1", "d1-handbook-1"]))).toEqual([
      { kind: "not_publishable", artifactId: "prep-1" },
    ]);
  });

  it("簡報、學員手冊、課程大綱可以發布", () => {
    expect(publicationProblems(snapshot(FRESH), pub(["outline-1", "d1-slides-1", "d2-slides-1", "d1-handbook-1"]))).toEqual([]);
  });

  it("只能鎖定同一門課程的產物與素材", () => {
    expect(publicationProblems(snapshot(FRESH), pub(["a-ci-slides-1"], ["m-ci-report"]))).toEqual([
      { kind: "foreign_artifact", artifactId: "a-ci-slides-1" },
      { kind: "foreign_material", materialId: "m-ci-report" },
    ]);
  });
});

describe("課綱討論：課程大綱與客戶回饋", () => {
  const project = getProject(st, "p-a-2026")!;

  it("列出回應某一版課程大綱的客戶回饋", () => {
    expect(outlineFeedback(project, "a-ci-outline-1").map((d) => d.id)).toEqual(["doc-a-feedback-1"]);
  });

  it("沒有回饋的版本回傳空陣列", () => {
    expect(outlineFeedback(project, "a-ci-outline-2")).toEqual([]);
  });
});
