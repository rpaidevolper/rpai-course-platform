import { describe, expect, it } from "vitest";
import { demoReducer, type DemoAction } from "./actions";
import { closingGate, closingGateReasons, finalArtifacts } from "./closing";
import { draftAcceptBlock } from "./draft-review";
import { getCourse, instructorEdit, isStale, staleReasons } from "./logic";
import { initialState, type DemoState } from "./state";
import type { KnowledgeDraft } from "./types";

/** 整體驗收的修正（#124）：重新結案、結案閘看進行中的工作、結案後可發布、上傳綁最新上游、草稿依據含手冊。 */

const COURSE = "c-pa-pilot";
const SESSION = "s-pp-0904";
const run = (actions: DemoAction[], from: DemoState = initialState()) => actions.reduce(demoReducer, from);
const course = (st: DemoState) => getCourse(st, COURSE)!;
const pending = (st: DemoState): KnowledgeDraft[] => st.drafts.filter((d) => d.fromCourseId === COURSE);

/** 逐份接受這門課的待審草稿；回傳被拒絕的（接受後草稿還在）。 */
function acceptAll(from: DemoState): { st: DemoState; refused: KnowledgeDraft[] } {
  let st = from;
  const refused: KnowledgeDraft[] = [];
  for (const d of pending(from)) {
    if (!st.drafts.some((x) => x.id === d.id)) continue; // 已隨配方一起收進
    st = demoReducer(st, { type: "draft/accept", draftId: d.id });
    if (st.drafts.some((x) => x.id === d.id)) refused.push(d);
  }
  return { st, refused };
}

const ADDED_TITLE = "新加的開場";
/** 重新開啟後改藍圖：第 1 天第一個時段最前面加一個新單元 */
function addOpeningUnit(st: DemoState): DemoState {
  const bp = structuredClone(course(st).blueprint);
  const first = bp.days[0].slots[0].units[0];
  bp.days[0].slots[0].units.unshift({ ...first, title: ADDED_TITLE, minutes: 10, source: null, reuse: "new" });
  first.minutes -= 10;
  return demoReducer(st, { type: "blueprint/revise", courseId: COURSE, blueprint: bp, note: "加開場" });
}

describe("重新開啟再結案：草稿不撞號", () => {
  const sequence = () => {
    const first = acceptAll(run([{ type: "course/close", courseId: COURSE }]));
    const reopened = run([{ type: "course/reopen", courseId: COURSE }], first.st);
    const edited = addOpeningUnit(reopened);
    const again = run([{ type: "course/close", courseId: COURSE }], edited);
    return { first, again, second: acceptAll(again) };
  };

  it("結案 → 接受全部 → 重新開啟 → 改藍圖 → 再結案 → 接受全部：沒有被拒絕的草稿", () => {
    const { first, again, second } = sequence();
    expect(first.refused).toEqual([]);
    expect(course(again).closedAt).not.toBeNull();
    expect(pending(again).length).toBeGreaterThan(0);
    expect(second.refused).toEqual([]);
    expect(pending(second.st)).toEqual([]);
  });

  it("兩次結案的新單元卡 id 都不同", () => {
    const { first, again } = sequence();
    const kbIds = new Set(first.st.unitCards.map((u) => u.id));
    const newCardIds = pending(again).flatMap((d) => (d.proposal.kind === "new_unit_card" ? [d.proposal.unitCard.id] : []));
    expect(newCardIds.length).toBeGreaterThan(0);
    for (const id of newCardIds) expect(kbIds.has(id)).toBe(false);
  });

  it("一門課只有一份配方：再結案是更新同一份，單元序列換成新的，新單元卡進知識庫", () => {
    const { first, again, second } = sequence();
    const mine = (st: DemoState) => st.recipes.filter((r) => r.id.includes(COURSE));
    expect(mine(first.st)).toHaveLength(1);
    const recipeDraft = pending(again).find((d) => d.proposal.kind === "new_course_recipe")!;
    expect(draftAcceptBlock(again, recipeDraft.id)).toBeNull();
    expect(mine(second.st)).toHaveLength(1);
    const before = mine(first.st)[0];
    const after = mine(second.st)[0];
    expect(after.id).toBe(before.id);
    expect(after.unitIds).not.toEqual(before.unitIds);
    expect(after.unitIds.length).toBe(before.unitIds.length + 1);
    // 配方引用的每張單元卡都在知識庫，而且新加的單元在裡面
    const titles = after.unitIds.map((id) => second.st.unitCards.find((u) => u.id === id)?.title);
    expect(titles).not.toContain(undefined);
    expect(titles).toContain(ADDED_TITLE);
  });

  it("更新配方時保留名稱與狀態，上課年月與標籤跟著這次結案", () => {
    const { first, second } = sequence();
    const before = first.st.recipes.find((r) => r.id.includes(COURSE))!;
    const after = second.st.recipes.find((r) => r.id === before.id)!;
    expect(after.title).toBe(before.title);
    expect(after.status).toBe(before.status);
    expect(after.heldOn).not.toBeNull();
  });
});

describe("接受被拒絕時說明原因", () => {
  it("沒有單元的配方草稿：draftAcceptBlock 回傳原因，acceptDraft 不動", () => {
    let st = run([{ type: "course/close", courseId: COURSE }]);
    const recipe = pending(st).find((d) => d.proposal.kind === "new_course_recipe")!;
    if (recipe.proposal.kind !== "new_course_recipe") throw new Error();
    const emptied = recipe.proposal;
    st = { ...st, drafts: st.drafts.map((d) => (d.id === recipe.id ? { ...d, proposal: { ...emptied, unitCardIds: [] } } : d)) };
    expect(draftAcceptBlock(st, recipe.id)).toMatch(/單元/);
    expect(demoReducer(st, { type: "draft/accept", draftId: recipe.id }).drafts).toEqual(st.drafts);
  });

  it("新單元卡的 id 已經在知識庫：拒絕並說明，不是默默丟掉草稿", () => {
    const st = run([{ type: "course/close", courseId: COURSE }]);
    const unit = pending(st).find((d) => d.proposal.kind === "new_unit_card")!;
    if (unit.proposal.kind !== "new_unit_card") throw new Error();
    const dup = { ...st, unitCards: [...st.unitCards, unit.proposal.unitCard] };
    expect(draftAcceptBlock(dup, unit.id)).toMatch(/已有/);
    const after = demoReducer(dup, { type: "draft/accept", draftId: unit.id });
    expect(after.drafts.some((d) => d.id === unit.id)).toBe(true);
  });

  it("可以接受的草稿沒有原因", () => {
    const st = run([{ type: "course/close", courseId: COURSE }]);
    for (const d of pending(st)) expect(draftAcceptBlock(st, d.id)).toBeNull();
  });
});

describe("結案閘：還有進行中的工作不能結案", () => {
  const gate = (st: DemoState) => closingGate(st, course(st), st.now);
  const request = (): DemoState => run([{ type: "artifact/request", id: "a-x", courseId: COURSE, kind: "outline", day: null }]);

  it("沒有工作時可以結案", () => {
    expect(gate(initialState()).canClose).toBe(true);
    expect(closingGateReasons(gate(initialState()))).toEqual([]);
  });

  it("pending 與 generating 都擋下並列出原因，course/close 不動", () => {
    const pendingSt = request();
    expect(gate(pendingSt).canClose).toBe(false);
    expect(closingGateReasons(gate(pendingSt)).join("；")).toContain("工作");
    expect(demoReducer(pendingSt, { type: "course/close", courseId: COURSE })).toBe(pendingSt);
    const generating = run([{ type: "artifact/advance", courseId: COURSE, artifactId: "a-x", from: "pending" }], pendingSt);
    expect(gate(generating).canClose).toBe(false);
    expect(course(demoReducer(generating, { type: "course/close", courseId: COURSE })).closedAt).toBeNull();
  });

  it("工作做完（ready）後又可以結案", () => {
    const done = run(
      [
        { type: "artifact/advance", courseId: COURSE, artifactId: "a-x", from: "pending" },
        { type: "artifact/advance", courseId: COURSE, artifactId: "a-x", from: "generating" },
      ],
      request(),
    );
    expect(gate(done).canClose).toBe(true);
  });
});

describe("結案後仍可發布場次", () => {
  it("session/publish 不在凍結名單；結案後發布會更新發布紀錄", () => {
    const closed = run([{ type: "course/close", courseId: COURSE }]);
    const after = demoReducer(closed, { type: "session/publish", sessionId: SESSION });
    const pub = after.sessions.find((s) => s.id === SESSION)!.publication;
    expect(pub).not.toBeNull();
    expect(pub!.publishedAt).toBe(after.now);
    expect(pub!.artifactIds).toContain("a-pp-handbook-2");
  });
});

describe("講師上傳的改版綁最新的上游", () => {
  it("示範課程的最終版手冊不顯示已過期", () => {
    const c = course(initialState());
    const handbook = c.artifacts.find((a) => a.id === "a-pp-handbook-2")!;
    expect(staleReasons(c, handbook)).toEqual([]);
    expect(isStale(c, handbook)).toBe(false);
  });

  it("上傳手冊改版：上游改綁那一天簡報目前最新的 ready 版本", () => {
    const st = run([{ type: "artifact/uploadEdit", courseId: COURSE, baseId: "a-pp-handbook-1", id: "a-hb-up" }]);
    const up = course(st).artifacts.find((a) => a.id === "a-hb-up")!;
    expect(up.upstreamIds).toEqual(["a-pp-slides-2"]);
    expect(isStale(course(st), up)).toBe(false);
  });

  it("最新的簡報還在產出時不綁它，仍綁最新的 ready 版本", () => {
    const st = run([{ type: "artifact/request", id: "a-s3", courseId: COURSE, kind: "slides", day: 1 }]);
    const edit = instructorEdit(course(st), "a-pp-handbook-2", { id: "a-hb-up", createdAt: st.now });
    expect(edit.upstreamIds).toEqual(["a-pp-slides-2"]);
  });

  it("沒有上游的產物，上傳後仍沒有上游", () => {
    const edit = instructorEdit(course(initialState()), "a-pp-slides-1", { id: "a-s-up", createdAt: "2026-10-24T00:00:00+08:00" });
    expect(edit.upstreamIds).toEqual([]);
  });
});

describe("結案草稿的依據含最終版手冊", () => {
  it("finalArtifacts：簡報之外，有動手環節那天的學員手冊最終版也算，依天數、簡報在前", () => {
    expect(finalArtifacts(course(initialState())).map((a) => a.id)).toEqual(["a-pp-slides-2", "a-pp-handbook-2"]);
  });

  it("草稿的 basis.finalArtifactIds 包含手冊", () => {
    const st = run([{ type: "course/close", courseId: COURSE }]);
    expect(pending(st).length).toBeGreaterThan(0);
    for (const d of pending(st)) expect(d.basis).toEqual({ blueprintVersion: 2, finalArtifactIds: ["a-pp-slides-2", "a-pp-handbook-2"] });
  });
});

describe("起始藍圖的 audience.who", () => {
  it("是「<公司>的學員」，不把產業素材包的標籤類別寫進去", () => {
    const st = run([{ type: "course/create", id: "c-z", projectId: "p-f-2026", title: "新課", moduleIds: ["A4"], totalHours: 6, industryPackId: "ip-finance-approval" }]);
    const company = st.projects.find((p) => p.id === "p-f-2026")!.clientContext.company;
    expect(getCourse(st, "c-z")!.blueprint.audience.who).toBe(`${company}的學員`);
  });
});
