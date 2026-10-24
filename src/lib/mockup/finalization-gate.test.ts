import { describe, expect, it } from "vitest";
import { gateBlockText, generationGate, getCourse, instructorEdit, isHandsOnDay } from "./logic";
import type { Artifact, Course } from "./types";
import { initialState } from "./state";

const st = initialState();

/**
 * 定稿閘：給一個想排的產檔工作，回傳可以（空陣列）或被哪一步擋住。
 * 每個測試自己組一份兩天課程的快照，不依賴 fixture 示範的狀態。
 */

const base = getCourse(st, "c-gas-two-day")!;
const FINALIZED = "2026-10-02T12:00:00+08:00";

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

/** 藍圖各版本：[版本, 是否定稿] */
function snapshot(artifacts: Artifact[], blueprint: [number, boolean][] = [[1, true]]): Course {
  return {
    ...base,
    blueprintHistory: blueprint.map(([version, finalized]) => ({
      version,
      createdAt: "2026-09-30T10:00:00+08:00",
      note: "",
      finalizedAt: finalized ? FINALIZED : null,
    })),
    artifacts,
  };
}

/** 把指定天的所有單元改成純講述（activity 為 null），其他不變。 */
const lectureOnlyDays = (course: Course, days: number[]): Course => ({
  ...course,
  blueprint: {
    ...course.blueprint,
    days: course.blueprint.days.map((d, i) =>
      days.includes(i + 1) ? { ...d, slots: d.slots.map((s) => ({ ...s, units: s.units.map((u) => ({ ...u, activity: null })) })) } : d,
    ),
  },
});

const slides = (day: number, version: number, finalized: boolean, extra: Partial<Artifact> = {}) =>
  v({ id: `d${day}-slides-${version}`, kind: "slides", day, version, finalizedAt: finalized ? FINALIZED : null, ...extra });

const texts = (course: Course, job: Parameters<typeof generationGate>[1]) => generationGate(course, job).map(gateBlockText);

describe("課程大綱與講師準備單不設閘", () => {
  it.each(["outline", "prep_sheet"] as const)("%s：藍圖沒定稿、什麼都還沒產也可以排", (kind) => {
    const course = snapshot([], [[1, false]]);
    expect(generationGate(course, { kind, day: null })).toEqual([]);
  });
});

describe("簡報需要藍圖最新版已定稿", () => {
  it("最新版已定稿：每一天都可以排，不需要其他上游", () => {
    const course = snapshot([], [[1, false], [2, true]]);
    expect(generationGate(course, { kind: "slides", day: 1 })).toEqual([]);
    expect(generationGate(course, { kind: "slides", day: 2 })).toEqual([]);
  });

  it("最新版還沒定稿：被擋，並指出是哪一版藍圖", () => {
    const course = snapshot([], [[1, false]]);
    expect(generationGate(course, { kind: "slides", day: 1 })).toEqual([{ kind: "blueprint_not_finalized", version: 1 }]);
    expect(texts(course, { kind: "slides", day: 1 })).toEqual(["藍圖 v1 還沒定稿"]);
  });

  it("舊版定稿過不算：v2 定稿後又升 v3 沒定稿，還是被擋", () => {
    const course = snapshot([], [[1, false], [2, true], [3, false]]);
    expect(texts(course, { kind: "slides", day: 2 })).toEqual(["藍圖 v3 還沒定稿"]);
  });
});

describe("某天學員手冊需要該天最新可用的簡報已定稿且沒過期", () => {
  const day2Handbook = { kind: "handbook", day: 2 } as const;

  it("該天簡報已定稿：可以排", () => {
    expect(generationGate(snapshot([slides(2, 1, true)]), day2Handbook)).toEqual([]);
  });

  it("只看那一天：第 1 天簡報沒定稿，不影響第 2 天手冊", () => {
    expect(generationGate(snapshot([slides(1, 1, false), slides(2, 1, true)]), day2Handbook)).toEqual([]);
  });

  it("該天簡報還沒定稿：被擋，指出第幾天的哪一版", () => {
    const course = snapshot([slides(1, 1, true), slides(2, 1, false)]);
    expect(generationGate(course, day2Handbook)).toEqual([{ kind: "slides_not_finalized", day: 2, version: 1 }]);
    expect(texts(course, day2Handbook)).toEqual(["第 2 天簡報 v1 還沒定稿"]);
  });

  it("該天還沒有簡報：被擋，指出要先產那天的簡報", () => {
    const course = snapshot([slides(1, 1, true)]);
    expect(generationGate(course, day2Handbook)).toEqual([{ kind: "slides_missing", day: 2 }]);
    expect(texts(course, day2Handbook)).toEqual(["第 2 天簡報還沒有可用的版本"]);
  });

  it.each(["pending", "generating", "failed"] as const)("該天簡報只有 %s 的版本：算還沒有可用版本", (status) => {
    expect(generationGate(snapshot([slides(2, 1, false, { status })]), day2Handbook)).toEqual([{ kind: "slides_missing", day: 2 }]);
  });

  it("舊版定稿過不算：v1 定稿、v2 已可用但沒定稿，被 v2 擋住", () => {
    const course = snapshot([slides(2, 1, true), slides(2, 2, false)]);
    expect(texts(course, day2Handbook)).toEqual(["第 2 天簡報 v2 還沒定稿"]);
  });

  it.each(["pending", "generating", "failed"] as const)("v1 已定稿、v2 還是 %s：最新可用版仍是 v1，可以排", (status) => {
    const course = snapshot([slides(2, 1, true), slides(2, 2, false, { status })]);
    expect(generationGate(course, day2Handbook)).toEqual([]);
  });

  it("簡報定稿過但已過期（藍圖升版）：被擋，說明要先依新藍圖重產", () => {
    const course = snapshot([slides(2, 1, true)], [[1, true], [2, true]]);
    expect(generationGate(course, day2Handbook)).toEqual([{ kind: "slides_stale", day: 2, version: 1 }]);
    expect(texts(course, day2Handbook)).toEqual(["第 2 天簡報 v1 已過期，要先重產並定稿"]);
  });

  it("講師上傳修改過的簡報是新版本，要重新定稿才能排手冊", () => {
    const course = snapshot([slides(2, 1, true)]);
    const edited = instructorEdit(course, "d2-slides-1", { id: "d2-slides-2", createdAt: "2026-10-03T09:00:00+08:00" });
    expect(edited.finalizedAt).toBeNull();
    expect(texts(snapshot([slides(2, 1, true), edited]), day2Handbook)).toEqual(["第 2 天簡報 v2 還沒定稿"]);
  });
});

describe("學員手冊只給含動手環節的天", () => {
  it("純講述的天不能要求產手冊，原因寫明", () => {
    const course = lectureOnlyDays(snapshot([slides(1, 1, true), slides(2, 1, true)]), [2]);
    expect(isHandsOnDay(course, 1)).toBe(true);
    expect(isHandsOnDay(course, 2)).toBe(false);
    expect(generationGate(course, { kind: "handbook", day: 2 })).toEqual([{ kind: "no_hands_on", day: 2 }]);
    expect(texts(course, { kind: "handbook", day: 2 })).toEqual(["第 2 天沒有動手環節，不產學員手冊"]);
  });

  it("只列純講述這個原因：即使簡報也沒定稿", () => {
    const course = lectureOnlyDays(snapshot([]), [2]);
    expect(generationGate(course, { kind: "handbook", day: 2 })).toEqual([{ kind: "no_hands_on", day: 2 }]);
  });

  it("同一門課含動手環節的那天照常可以產", () => {
    const course = lectureOnlyDays(snapshot([slides(1, 1, true)]), [2]);
    expect(generationGate(course, { kind: "handbook", day: 1 })).toEqual([]);
  });

  it("只要有一個單元的 activity 不是 null，那天就算含動手環節", () => {
    const course = snapshot([]);
    const oneUnit = {
      ...course,
      blueprint: {
        ...course.blueprint,
        days: course.blueprint.days.map((d) => ({
          ...d,
          slots: d.slots.map((s, si) => ({ ...s, units: s.units.map((u, ui) => ({ ...u, activity: si === 0 && ui === 0 ? "動手做一次" : null })) })),
        })),
      },
    };
    expect(isHandsOnDay(oneUnit, 1)).toBe(true);
  });
});

describe("不存在的產檔工作", () => {
  const course = snapshot([]);

  it.each([0, 3, null])("簡報與學員手冊的天不在藍圖範圍內（%s）就丟例外", (day) => {
    expect(() => generationGate(course, { kind: "slides", day })).toThrow();
    expect(() => generationGate(course, { kind: "handbook", day })).toThrow();
  });

  it.each(["outline", "prep_sheet"] as const)("%s 是整門課一份，帶了天就丟例外", (kind) => {
    expect(() => generationGate(course, { kind, day: 1 })).toThrow();
  });
});
