import { describe, expect, it } from "vitest";
import { demoReducer, newSessionDay, type DemoAction } from "./actions";
import { FROZEN_AFTER_CLOSING, isFrozenByClosing, isProjectClosed, reopenWithdrawals } from "./closing";
import { getCourse } from "./logic";
import { initialState, type DemoState } from "./state";
import type { KnowledgeDraft } from "./types";

/**
 * 結案後課程凍結（#77）：凍結的操作 reducer 一律拒絕（回傳原狀態）；學員入口的管理不受影響；
 * 可以重新開啟，撤回這門課結案時產生、還在待審的草稿，已收進知識庫的內容不動。
 */

const COURSE = "c-pa-pilot";
const PROJECT = "p-f-2026";
const SESSION = "s-pp-0904";
const LINK = { label: "錄影", url: "https://example.com/rec" };
const day = newSessionDay("2026-12-01T09:00:00+08:00", "2026-12-01T16:00:00+08:00", null);

/** 先導班加上連結、素材、藍圖還沒定稿、大綱還沒寄出，凍結前每個操作才都有東西可以改 */
const prepared = (): DemoState => {
  const st = initialState();
  return {
    ...st,
    courses: st.courses.map((c) =>
      c.id === COURSE
        ? { ...c, blueprintHistory: c.blueprintHistory.map((v) => ({ ...v, finalizedAt: null })), materials: [{ id: "m-pp-1", name: "欄位對照.xlsx", sizeKb: 12 }], artifacts: c.artifacts.map((a) => (a.kind === "outline" ? { ...a, sentToClientAt: null } : a)) }
        : c,
    ),
    sessions: st.sessions.map((s) => (s.id === SESSION ? { ...s, links: [LINK] } : s)),
  };
};
const closed = (): DemoState => demoReducer(prepared(), { type: "course/close", courseId: COURSE });
const bp = (st: DemoState) => getCourse(st, COURSE)!.blueprint;

const FROZEN: Record<(typeof FROZEN_AFTER_CLOSING)[number], (st: DemoState) => DemoAction> = {
  "session/create": () => ({ type: "session/create", id: "s-new", courseId: COURSE, days: [day], portalCode: "z1" }),
  "session/updateDays": () => ({ type: "session/updateDays", sessionId: SESSION, days: [day] }),
  "link/add": () => ({ type: "link/add", sessionId: SESSION, label: "回饋表單", url: "https://example.com/form" }),
  "link/remove": () => ({ type: "link/remove", sessionId: SESSION, url: LINK.url }),
  "artifact/request": () => ({ type: "artifact/request", id: "a-new", courseId: COURSE, kind: "outline", day: null }),
  "artifact/uploadEdit": () => ({ type: "artifact/uploadEdit", courseId: COURSE, baseId: "a-pp-slides-2", id: "a-up" }),
  "artifact/finalize": () => ({ type: "artifact/finalize", courseId: COURSE, artifactId: "a-pp-slides-2" }),
  "artifact/markSent": () => ({ type: "artifact/markSent", courseId: COURSE, artifactId: "a-pp-outline-1" }),
  "blueprint/revise": (st) => ({ type: "blueprint/revise", courseId: COURSE, blueprint: bp(st), note: "改" }),
  "blueprint/finalize": () => ({ type: "blueprint/finalize", courseId: COURSE }),
  "material/add": () => ({ type: "material/add", id: "m-new", courseId: COURSE, name: "x.pdf", sizeKb: 1 }),
  "material/remove": () => ({ type: "material/remove", courseId: COURSE, materialId: "m-pp-1" }),
  "course/updateTags": () => ({ type: "course/updateTags", courseId: COURSE, tags: { audiences: ["特定職能"], industries: [], scenarios: [] } }),
};

describe("結案後凍結的操作，reducer 一律拒絕", () => {
  it("測試涵蓋凍結名單的每一個操作，不多不少", () => {
    expect(Object.keys(FROZEN).sort()).toEqual([...FROZEN_AFTER_CLOSING].sort());
  });

  for (const [type, make] of Object.entries(FROZEN) as [DemoAction["type"], (st: DemoState) => DemoAction][]) {
    it(`${type}：結案後回傳原狀態，結案前可以做`, () => {
      const st = closed();
      expect(demoReducer(st, make(st))).toBe(st);
      expect(isFrozenByClosing(getCourse(st, COURSE), type)).toBe(true);
      // 對照：沒結案時同一個操作真的會改到課程或場次，所以上面的拒絕是凍結造成的
      const open = prepared();
      const done = demoReducer(open, make(open));
      expect([done.courses, done.sessions]).not.toEqual([open.courses, open.sessions]);
      expect(isFrozenByClosing(getCourse(open, COURSE), type)).toBe(false);
    });
  }

  it("沒列在凍結名單的操作不受影響", () => {
    expect(isFrozenByClosing(getCourse(closed(), COURSE), "portal/close")).toBe(false);
    expect(isFrozenByClosing(getCourse(closed(), COURSE), "artifact/advance")).toBe(false);
    expect(isFrozenByClosing(undefined, "session/create")).toBe(false);
  });
});

describe("結案後學員入口的管理仍然可以用", () => {
  it("關閉、重新開放、延長期限", () => {
    const st = closed();
    const off = demoReducer(st, { type: "portal/close", sessionId: SESSION });
    expect(off.sessions.find((s) => s.id === SESSION)!.portal.closedAt).not.toBeNull();
    const on = demoReducer(off, { type: "portal/reopen", sessionId: SESSION });
    expect(on.sessions.find((s) => s.id === SESSION)!.portal.closedAt).toBeNull();
    const ext = demoReducer(on, { type: "portal/extend", sessionId: SESSION, days: 7 });
    expect(ext.sessions.find((s) => s.id === SESSION)!.portal.expiresAtOverride).not.toBeNull();
  });
});

const pendingOf = (st: DemoState, courseId: string): KnowledgeDraft[] => st.drafts.filter((d) => d.fromCourseId === courseId);

describe("重新開啟", () => {
  it("清掉 closedAt，撤回這門課結案時產生、還在待審的草稿", () => {
    const st = closed();
    expect(pendingOf(st, COURSE).length).toBeGreaterThan(0);
    const other = st.drafts.filter((d) => d.fromCourseId !== COURSE);
    const after = demoReducer(st, { type: "course/reopen", courseId: COURSE });
    expect(getCourse(after, COURSE)!.closedAt).toBeNull();
    expect(pendingOf(after, COURSE)).toEqual([]);
    expect(after.drafts).toEqual(other);
  });

  it("預告撤回的草稿與實際撤回的一致", () => {
    const st = closed();
    expect(reopenWithdrawals(st, COURSE).map((d) => d.id)).toEqual(pendingOf(st, COURSE).map((d) => d.id));
    expect(reopenWithdrawals(initialState(), COURSE)).toEqual([]);
  });

  it("已經收進知識庫的內容不受影響，只撤回還在待審的", () => {
    const st = closed();
    const recipeDraft = st.drafts.find((d) => d.fromCourseId === COURSE && d.proposal.kind === "new_course_recipe")!;
    const accepted = demoReducer(st, { type: "draft/accept", draftId: recipeDraft.id });
    expect(accepted.recipes.length).toBeGreaterThan(st.recipes.length);
    const after = demoReducer(accepted, { type: "course/reopen", courseId: COURSE });
    expect(after.recipes).toEqual(accepted.recipes);
    expect(after.unitCards).toEqual(accepted.unitCards);
    expect(after.moduleCards).toEqual(accepted.moduleCards);
    expect(pendingOf(after, COURSE)).toEqual([]);
  });

  it("重新開啟後恢復可以修改；再結案會重新產生草稿", () => {
    const reopened = demoReducer(closed(), { type: "course/reopen", courseId: COURSE });
    const st = demoReducer(reopened, FROZEN["material/add"](reopened));
    expect(getCourse(st, COURSE)!.materials.some((m) => m.id === "m-new")).toBe(true);
    const again = demoReducer(st, { type: "course/close", courseId: COURSE });
    expect(getCourse(again, COURSE)!.closedAt).not.toBeNull();
    expect(pendingOf(again, COURSE).length).toBeGreaterThan(0);
  });

  it("沒結案的課程重新開啟是空操作", () => {
    const st = prepared();
    expect(demoReducer(st, { type: "course/reopen", courseId: COURSE })).toBe(st);
    expect(demoReducer(st, { type: "course/reopen", courseId: "nope" })).toBe(st);
  });

  it("專案的結案狀態推回去：重新開啟任一門課程，專案就不再是已結案", () => {
    const st = closed();
    expect(isProjectClosed(st, PROJECT)).toBe(true);
    expect(isProjectClosed(demoReducer(st, { type: "course/reopen", courseId: COURSE }), PROJECT)).toBe(false);
  });
});
