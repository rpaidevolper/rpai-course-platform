import { describe, expect, it } from "vitest";
import { demoReducer, newSessionDay, type DemoAction } from "./actions";
import { closingGate, closingGateReasons, isCourseClosed, isProjectClosed, projectGroups } from "./closing";
import { getCourse, getProject } from "./logic";
import { initialState, type DemoState } from "./state";
import type { Artifact, Course, Session } from "./types";

/**
 * 結案閘：每天的最終版簡報、含動手環節的天另外要有最終版學員手冊（講師上傳的版本）都齊了，
 * 而且所有場次都已結束，才能結案。
 * 每個測試自己組一份兩天課程的快照，不依賴 fixture 示範的狀態。
 */

const COURSE = "c-gas-two-day";
const NOW = "2026-11-10T10:00:00+08:00";
const PAST = "2026-11-01T09:00:00+08:00";

function art(a: Pick<Artifact, "id" | "kind"> & Partial<Artifact>): Artifact {
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
/** AI 產的第 1 版，再加上講師上傳的第 2 版（最終版） */
const uploaded = (kind: "slides" | "handbook", day: number): Artifact[] => [
  art({ id: `${kind}-${day}-1`, kind, day, version: 1 }),
  art({ id: `${kind}-${day}-2`, kind, day, version: 2, editedFromId: `${kind}-${day}-1` }),
];
const aiOnly = (kind: "slides" | "handbook", day: number): Artifact[] => [art({ id: `${kind}-${day}-1`, kind, day, version: 1 })];

const session = (id: string, endsAt: string, courseId = COURSE): Session => ({
  id,
  courseId,
  days: [
    { startsAt: "2026-10-30T09:00:00+08:00", endsAt: PAST, venue: null, instructorId: "inst-lin" },
    { startsAt: "2026-10-31T09:00:00+08:00", endsAt, venue: null, instructorId: "inst-lin" },
  ],
  links: [],
  publication: null,
  portal: { code: id, closedAt: null, expiresAtOverride: null },
});

/** 以兩天課程為底：換掉產物與場次，時鐘放在 NOW */
function world(artifacts: Artifact[], sessions: Session[] = [session("s1", PAST)], base: DemoState = initialState()): DemoState {
  return {
    ...base,
    now: NOW,
    courses: base.courses.map((c) => (c.id === COURSE ? { ...c, artifacts, closedAt: null } : c)),
    sessions: [...base.sessions.filter((s) => s.courseId !== COURSE), ...sessions],
  };
}
const gate = (st: DemoState) => closingGate(st, getCourse(st, COURSE)!, st.now);
const SLIDES = [...uploaded("slides", 1), ...uploaded("slides", 2)];
const HANDBOOKS = [...uploaded("handbook", 1), ...uploaded("handbook", 2)];
const FULL = [...SLIDES, ...HANDBOOKS];

/** 把指定的天改成純講述（所有單元的 activity 為 null）；兩天課程的兩天原本都有動手環節 */
const withLectureOnlyDays = (st: DemoState, days: number[]): DemoState => ({
  ...st,
  courses: st.courses.map((c) =>
    c.id !== COURSE
      ? c
      : {
          ...c,
          blueprint: {
            ...c.blueprint,
            days: c.blueprint.days.map((d, i) =>
              days.includes(i + 1) ? { ...d, slots: d.slots.map((s) => ({ ...s, units: s.units.map((u) => ({ ...u, activity: null })) })) } : d,
            ),
          },
        },
  ),
});
const run = (actions: DemoAction[], from: DemoState) => actions.reduce(demoReducer, from);

describe("結案閘：缺哪一天的哪一種最終版", () => {
  it("每天的簡報都有講師上傳的版本、場次都結束了，才放行", () => {
    const g = gate(world(FULL));
    expect(g.missingFinals).toEqual([]);
    expect(g.unfinishedSessionIds).toEqual([]);
    expect(g.canClose).toBe(true);
  });

  it("只缺某一天的簡報時，只回報那一天的簡報", () => {
    const g = gate(world([...uploaded("slides", 1), ...aiOnly("slides", 2), ...HANDBOOKS]));
    expect(g.missingFinals).toEqual([{ kind: "slides", day: 2 }]);
    expect(g.canClose).toBe(false);
  });

  it("AI 產的版本沒改過也不算，要講師重新上傳", () => {
    const g = gate(world([...aiOnly("slides", 1), ...uploaded("slides", 2), ...HANDBOOKS]));
    expect(g.missingFinals).toEqual([{ kind: "slides", day: 1 }]);
  });

  it("還沒產過簡報與手冊的天也算缺，依天數列出，同一天簡報在前、手冊在後", () => {
    const g = gate(world([]));
    expect(g.missingFinals).toEqual([
      { kind: "slides", day: 1 },
      { kind: "handbook", day: 1 },
      { kind: "slides", day: 2 },
      { kind: "handbook", day: 2 },
    ]);
  });

  it("講師上傳之後 AI 又重產的版本不會讓最終版消失", () => {
    const g = gate(world([...FULL, art({ id: "slides-2-3", kind: "slides", day: 2, version: 3 })]));
    expect(g.missingFinals).toEqual([]);
  });

  it("有動手環節的天缺最終版學員手冊就不能結案；補上就可以", () => {
    const missing = gate(world([...SLIDES, ...uploaded("handbook", 1), ...aiOnly("handbook", 2)]));
    expect(missing.missingFinals).toEqual([{ kind: "handbook", day: 2 }]);
    expect(missing.canClose).toBe(false);
    const fixed = gate(world([...SLIDES, ...uploaded("handbook", 1), ...uploaded("handbook", 2)]));
    expect(fixed.missingFinals).toEqual([]);
    expect(fixed.canClose).toBe(true);
  });

  it("AI 產的手冊沒上傳不算最終版；講師上傳後 AI 又重產的版本不會讓它消失", () => {
    expect(gate(world([...SLIDES, ...aiOnly("handbook", 1), ...uploaded("handbook", 2)])).missingFinals).toEqual([{ kind: "handbook", day: 1 }]);
    const regenerated = art({ id: "handbook-1-3", kind: "handbook", day: 1, version: 3 });
    expect(gate(world([...FULL, regenerated])).missingFinals).toEqual([]);
  });

  it("手冊的最終版不能代替簡報的最終版", () => {
    expect(gate(world(HANDBOOKS)).missingFinals).toEqual([
      { kind: "slides", day: 1 },
      { kind: "slides", day: 2 },
    ]);
  });

  it("純講述的天不要求手冊；含動手環節的天仍要求", () => {
    const st = (artifacts: Artifact[]) => withLectureOnlyDays(world(artifacts), [2]);
    const g = gate(st([...SLIDES, ...uploaded("handbook", 1)]));
    expect(g.missingFinals).toEqual([]);
    expect(g.canClose).toBe(true);
    expect(gate(st(SLIDES)).missingFinals).toEqual([{ kind: "handbook", day: 1 }]);
  });

  it("整門課程都是純講述時，只要簡報的最終版就能結案", () => {
    const g = gate(withLectureOnlyDays(world(SLIDES), [1, 2]));
    expect(g.missingFinals).toEqual([]);
    expect(g.canClose).toBe(true);
  });

  it("缺漏的文字寫出天與產物種類", () => {
    const g = gate(world([...uploaded("slides", 1), ...HANDBOOKS]));
    expect(closingGateReasons(g).join("；")).toContain("第 2 天簡報");
  });

  it("缺手冊時，文字寫出是第幾天的學員手冊", () => {
    const g = gate(world([...SLIDES, ...uploaded("handbook", 1)]));
    expect(closingGateReasons(g)).toEqual(["還缺最終版：第 2 天學員手冊"]);
  });
});

describe("結案閘：阻擋原因", () => {
  it("全部齊了沒有原因；缺最終版、沒場次、場次沒結束各一條", () => {
    expect(closingGateReasons(gate(world(FULL, [session("s1", PAST)])))).toEqual([]);
    const reasons = closingGateReasons(gate(world([], [])));
    expect(reasons).toHaveLength(2);
    expect(reasons[0]).toContain("還缺最終版");
    expect(reasons[1]).toBe("還沒有任何場次");
    expect(closingGateReasons(gate(world(FULL, [session("s2", "2026-11-20T16:00:00+08:00")])))).toEqual(["還有 1 個場次沒結束"]);
  });
});

describe("結案閘：場次都要結束", () => {
  it("有場次還沒結束就擋住，並列出是哪一場", () => {
    const st = world(FULL, [session("s1", PAST), session("s2", "2026-11-20T16:00:00+08:00")]);
    const g = gate(st);
    expect(g.unfinishedSessionIds).toEqual(["s2"]);
    expect(g.canClose).toBe(false);
  });

  it("場次最後一天正好到結束時間就算結束", () => {
    expect(gate(world(FULL, [session("s1", NOW)])).canClose).toBe(true);
  });

  it("沒有任何場次的課程不能結案（還沒上過課）", () => {
    const g = gate(world(FULL, []));
    expect(g.hasSessions).toBe(false);
    expect(g.canClose).toBe(false);
  });
});

describe("結案", () => {
  it("閘全過時結案，closedAt 記下 demo 時鐘", () => {
    const st = run([{ type: "course/close", courseId: COURSE }], world(FULL));
    const course = getCourse(st, COURSE)!;
    expect(isCourseClosed(course)).toBe(true);
    expect(course.closedAt).toBe(st.now);
  });

  it("閘沒過時結案被拒絕，狀態不變", () => {
    const st = world([...uploaded("slides", 1), ...HANDBOOKS]);
    expect(demoReducer(st, { type: "course/close", courseId: COURSE })).toBe(st);
    expect(isCourseClosed(getCourse(st, COURSE)!)).toBe(false);
  });

  it("已結案的課程再結案，closedAt 不會被改掉", () => {
    const once = run([{ type: "course/close", courseId: COURSE }], world(FULL));
    const closedAt = getCourse(once, COURSE)!.closedAt;
    const twice = demoReducer(once, { type: "course/close", courseId: COURSE });
    expect(getCourse(twice, COURSE)!.closedAt).toBe(closedAt);
  });

  it("結案後不能新增場次", () => {
    const closed = run([{ type: "course/close", courseId: COURSE }], world(FULL));
    const day = newSessionDay("2026-12-01T09:00:00+08:00", "2026-12-01T16:00:00+08:00", null);
    const after = demoReducer(closed, { type: "session/create", id: "s-new", courseId: COURSE, days: [day, day], portalCode: "z1" });
    expect(after.sessions.some((s) => s.id === "s-new")).toBe(false);
  });

  it("沒結案的課程仍可新增場次", () => {
    const day = newSessionDay("2026-12-01T09:00:00+08:00", "2026-12-01T16:00:00+08:00", null);
    const after = demoReducer(world(FULL), { type: "session/create", id: "s-new", courseId: COURSE, days: [day, day], portalCode: "z1" });
    expect(after.sessions.some((s) => s.id === "s-new")).toBe(true);
  });
});

const PROJECT = "p-e-2026";
const withCourses = (st: DemoState, closed: boolean[]): DemoState => ({
  ...st,
  courses: [
    ...st.courses.filter((c) => c.projectId !== PROJECT),
    ...closed.map((isClosed, i): Course => ({ ...getCourse(st, COURSE)!, id: `x-${i}`, projectId: PROJECT, closedAt: isClosed ? NOW : null })),
  ],
});

describe("專案結案由底下課程推得", () => {
  const st0 = initialState();

  it("底下的課程全部結案，專案就結案", () => {
    expect(isProjectClosed(withCourses(st0, [true, true]), PROJECT)).toBe(true);
  });
  it("還有一門沒結案就不算", () => {
    expect(isProjectClosed(withCourses(st0, [true, false]), PROJECT)).toBe(false);
  });
  it("沒有任何課程的專案不算結案", () => {
    expect(isProjectClosed(withCourses(st0, []), PROJECT)).toBe(false);
  });
  it("結案不改專案狀態；封存的專案維持封存", () => {
    const st = withCourses(st0, [true]);
    const archived = { ...st, projects: st.projects.map((p) => (p.id === PROJECT ? { ...p, status: "archived" as const } : p)) };
    expect(isProjectClosed(archived, PROJECT)).toBe(true);
    expect(getProject(archived, PROJECT)!.status).toBe("archived");
    expect(getProject(st, PROJECT)!.status).toBe("active");
  });
  it("沒有專案時回傳 false", () => {
    expect(isProjectClosed(st0, "nope")).toBe(false);
  });
});

describe("專案列表分組：結案不混在進行中底下", () => {
  const st0 = initialState();
  const keys = (st: DemoState) => projectGroups(st, st.projects).map((g) => [g.key, g.projects.map((p) => p.id)]);

  it("順序固定為洽談中、進行中、已結案、封存，沒有專案的組也保留", () => {
    expect(projectGroups(st0, []).map((g) => g.key)).toEqual(["negotiating", "active", "closed", "archived"]);
  });
  it("進行中而且課程全部結案的專案歸已結案，不再列在進行中", () => {
    const st = withCourses(st0, [true, true]);
    const g = Object.fromEntries(keys(st));
    expect(g.closed).toContain(PROJECT);
    expect(g.active).not.toContain(PROJECT);
  });
  it("還沒全部結案的專案留在進行中", () => {
    const g = Object.fromEntries(keys(withCourses(st0, [true, false])));
    expect(g.active).toContain(PROJECT);
    expect(g.closed).not.toContain(PROJECT);
  });
  it("封存只代表沒成交：封存的專案就算課程都結案也留在封存", () => {
    const st = withCourses(st0, [true]);
    const archived = { ...st, projects: st.projects.map((p) => (p.id === PROJECT ? { ...p, status: "archived" as const } : p)) };
    const g = Object.fromEntries(keys(archived));
    expect(g.archived).toContain(PROJECT);
    expect(g.closed).not.toContain(PROJECT);
  });
});

describe("示範資料同時有可結案與被擋住的課程", () => {
  const st = initialState();
  it("先導班：最終版都齊、場次都上完，可以結案，結案後專案跟著結案", () => {
    expect(closingGate(st, getCourse(st, "c-pa-pilot")!, st.now).canClose).toBe(true);
    const closed = demoReducer(st, { type: "course/close", courseId: "c-pa-pilot" });
    expect(isProjectClosed(closed, "p-f-2026")).toBe(true);
  });
  it("兩天實戰營：缺最終版而且還有場次沒結束，被擋住", () => {
    const g = closingGate(st, getCourse(st, COURSE)!, st.now);
    expect(g.canClose).toBe(false);
    expect(g.missingFinals.length).toBeGreaterThan(0);
    expect(g.unfinishedSessionIds).toEqual(["s-gas-1020"]);
  });
});
