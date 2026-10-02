import { describe, expect, it } from "vitest";
import { gateBlockText, generationGate, getCourse, instructorEdit } from "./logic";
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

const script = (day: number, version: number, finalized: boolean, extra: Partial<Artifact> = {}) =>
  v({ id: `d${day}-script-${version}`, kind: "page_script", day, version, finalizedAt: finalized ? FINALIZED : null, ...extra });

const texts = (course: Course, job: Parameters<typeof generationGate>[1]) => generationGate(course, job).map(gateBlockText);

describe("課程大綱與講師準備單不設閘", () => {
  it.each(["outline", "prep_sheet"] as const)("%s：藍圖沒定稿、什麼都還沒產也可以排", (kind) => {
    const course = snapshot([], [[1, false]]);
    expect(generationGate(course, { kind, day: null })).toEqual([]);
  });
});

describe("逐頁腳本需要藍圖最新版已定稿", () => {
  it("最新版已定稿：每一天都可以排", () => {
    const course = snapshot([], [[1, false], [2, true]]);
    expect(generationGate(course, { kind: "page_script", day: 1 })).toEqual([]);
    expect(generationGate(course, { kind: "page_script", day: 2 })).toEqual([]);
  });

  it("最新版還沒定稿：被擋，並指出是哪一版藍圖", () => {
    const course = snapshot([], [[1, false]]);
    expect(generationGate(course, { kind: "page_script", day: 1 })).toEqual([{ kind: "blueprint_not_finalized", version: 1 }]);
    expect(texts(course, { kind: "page_script", day: 1 })).toEqual(["藍圖 v1 還沒定稿"]);
  });

  it("舊版定稿過不算：v2 定稿後又升 v3 沒定稿，還是被擋", () => {
    const course = snapshot([], [[1, false], [2, true], [3, false]]);
    expect(texts(course, { kind: "page_script", day: 2 })).toEqual(["藍圖 v3 還沒定稿"]);
  });
});

describe("某天簡報需要該天最新可用的逐頁腳本已定稿且沒過期", () => {
  const day2Slides = { kind: "slides", day: 2 } as const;

  it("該天逐頁腳本已定稿：可以排", () => {
    expect(generationGate(snapshot([script(2, 1, true)]), day2Slides)).toEqual([]);
  });

  it("只看那一天：第 1 天逐頁腳本沒定稿，不影響第 2 天簡報", () => {
    expect(generationGate(snapshot([script(1, 1, false), script(2, 1, true)]), day2Slides)).toEqual([]);
  });

  it("該天逐頁腳本還沒定稿：被擋，指出第幾天的哪一版", () => {
    const course = snapshot([script(1, 1, true), script(2, 1, false)]);
    expect(generationGate(course, day2Slides)).toEqual([{ kind: "script_not_finalized", day: 2, version: 1 }]);
    expect(texts(course, day2Slides)).toEqual(["第 2 天逐頁腳本 v1 還沒定稿"]);
  });

  it("該天還沒有逐頁腳本：被擋，指出要先產那天的逐頁腳本", () => {
    const course = snapshot([script(1, 1, true)]);
    expect(generationGate(course, day2Slides)).toEqual([{ kind: "script_missing", day: 2 }]);
    expect(texts(course, day2Slides)).toEqual(["第 2 天逐頁腳本還沒有可用的版本"]);
  });

  it.each(["pending", "generating", "failed"] as const)("該天逐頁腳本只有 %s 的版本：算還沒有可用版本", (status) => {
    expect(generationGate(snapshot([script(2, 1, false, { status })]), day2Slides)).toEqual([{ kind: "script_missing", day: 2 }]);
  });

  it("舊版定稿過不算：v1 定稿、v2 已可用但沒定稿，被 v2 擋住", () => {
    const course = snapshot([script(2, 1, true), script(2, 2, false)]);
    expect(texts(course, day2Slides)).toEqual(["第 2 天逐頁腳本 v2 還沒定稿"]);
  });

  it.each(["pending", "generating", "failed"] as const)("v1 已定稿、v2 還是 %s：最新可用版仍是 v1，可以排", (status) => {
    const course = snapshot([script(2, 1, true), script(2, 2, false, { status })]);
    expect(generationGate(course, day2Slides)).toEqual([]);
  });

  it("逐頁腳本定稿過但已過期（藍圖升版）：被擋，說明要先依新藍圖重產", () => {
    const course = snapshot([script(2, 1, true)], [[1, true], [2, true]]);
    expect(generationGate(course, day2Slides)).toEqual([{ kind: "script_stale", day: 2, version: 1 }]);
    expect(texts(course, day2Slides)).toEqual(["第 2 天逐頁腳本 v1 已過期，要先重產並定稿"]);
  });

  it("講師上傳修改過的逐頁腳本是新版本，要重新定稿才能排簡報", () => {
    const course = snapshot([script(2, 1, true)]);
    const edited = instructorEdit(course, "d2-script-1", { id: "d2-script-2", createdAt: "2026-10-03T09:00:00+08:00" });
    expect(edited.finalizedAt).toBeNull();
    expect(texts(snapshot([script(2, 1, true), edited]), day2Slides)).toEqual(["第 2 天逐頁腳本 v2 還沒定稿"]);
  });
});

describe("學員手冊需要每一天最新可用的逐頁腳本都已定稿且沒過期", () => {
  const handbook = { kind: "handbook", day: null } as const;

  it("兩天都已定稿：可以排", () => {
    expect(generationGate(snapshot([script(1, 1, true), script(2, 1, true)]), handbook)).toEqual([]);
  });

  it("只有一天沒定稿：被那一天擋住", () => {
    expect(texts(snapshot([script(1, 1, true), script(2, 1, false)]), handbook)).toEqual(["第 2 天逐頁腳本 v1 還沒定稿"]);
  });

  it("天數依藍圖：藍圖有兩天、只產了第 1 天，第 2 天算缺", () => {
    expect(texts(snapshot([script(1, 1, true)]), handbook)).toEqual(["第 2 天逐頁腳本還沒有可用的版本"]);
  });

  it("每一天的問題都列出，依天的順序", () => {
    expect(texts(snapshot([script(2, 1, false)]), handbook)).toEqual([
      "第 1 天逐頁腳本還沒有可用的版本",
      "第 2 天逐頁腳本 v1 還沒定稿",
    ]);
  });

  it("舊版定稿過不算：第 1 天 v2 已可用但沒定稿，被擋", () => {
    expect(texts(snapshot([script(1, 1, true), script(1, 2, false), script(2, 1, true)]), handbook)).toEqual([
      "第 1 天逐頁腳本 v2 還沒定稿",
    ]);
  });

  it.each(["pending", "generating", "failed"] as const)("第 1 天 v2 還是 %s：最新可用版仍是已定稿的 v1，可以排", (status) => {
    const course = snapshot([script(1, 1, true), script(1, 2, false, { status }), script(2, 1, true)]);
    expect(generationGate(course, handbook)).toEqual([]);
  });

  it("定稿過的逐頁腳本已過期（藍圖升版）：每一天都被擋", () => {
    const course = snapshot([script(1, 1, true), script(2, 1, true)], [[1, true], [2, true]]);
    expect(generationGate(course, handbook)).toEqual([
      { kind: "script_stale", day: 1, version: 1 },
      { kind: "script_stale", day: 2, version: 1 },
    ]);
  });
});

describe("不存在的產檔工作", () => {
  const course = snapshot([]);

  it.each([0, 3, null])("逐頁腳本與簡報的天不在藍圖範圍內（%s）就丟例外", (day) => {
    expect(() => generationGate(course, { kind: "page_script", day })).toThrow();
    expect(() => generationGate(course, { kind: "slides", day })).toThrow();
  });

  it.each(["outline", "prep_sheet", "handbook"] as const)("%s 是整門課一份，帶了天就丟例外", (kind) => {
    expect(() => generationGate(course, { kind, day: 1 })).toThrow();
  });
});
