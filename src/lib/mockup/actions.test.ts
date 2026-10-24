import { describe, expect, it } from "vitest";
import { BlueprintSchema, plannedMinutes, totalMinutes } from "@/lib/blueprint/schema";
import { addMs, demoReducer, newSessionDay, starterBlueprint, type DemoAction } from "./actions";
import {
  generationGate,
  getCourse,
  getIndustryPack,
  getModuleCard,
  getRecipe,
  getSession,
  getUnitCard,
  isStale,
  latestArtifact,
  portalState,
  portalView,
  readiness,
  recipeUnitCards,
} from "./logic";
import type { ModuleId } from "./types";
import { initialState, type DemoState } from "./state";

const run = (actions: DemoAction[], from: DemoState = initialState()) => actions.reduce(demoReducer, from);
const CI = "c-claude-intro";
const ready = (courseId: string, id: string): DemoAction[] => [
  { type: "artifact/advance", courseId, artifactId: id, from: "pending" },
  { type: "artifact/advance", courseId, artifactId: id, from: "generating" },
];

describe("demo 時鐘", () => {
  it("每個改動把時鐘推一分鐘，格式維持 +08:00", () => {
    expect(run([{ type: "portal/reopen", sessionId: "s-ci-1015" }]).now).toBe("2026-10-08T10:01:00+08:00");
  });
  it("addMs 保留台北時區", () => {
    expect(addMs("2026-10-18T16:30:00+08:00", 24 * 60 * 60 * 1000)).toBe("2026-10-19T16:30:00+08:00");
  });
});

describe("產物鏈與定稿閘", () => {
  it("新產物綁最新藍圖，版本號接續；排隊中 → 產出中 → 可用，狀態不符不動", () => {
    const st = run([{ type: "artifact/request", id: "a-new", courseId: CI, kind: "handbook", day: null }]);
    const a = latestArtifact(getCourse(st, CI)!, "handbook")!;
    expect(a).toMatchObject({ id: "a-new", version: 2, blueprintVersion: 3, status: "pending", upstreamIds: ["a-ci-script-d1-2"] });
    const status = (s: DemoState) => latestArtifact(getCourse(s, CI)!, "handbook")!.status;
    expect(status(run([{ type: "artifact/advance", courseId: CI, artifactId: "a-new", from: "generating" }], st))).toBe("pending");
    expect(status(run(ready(CI, "a-new"), st))).toBe("ready");
  });

  it("產出中時不能再排同一份產物", () => {
    const st = run([
      { type: "artifact/request", id: "a-1", courseId: CI, kind: "outline", day: null },
      { type: "artifact/request", id: "a-2", courseId: CI, kind: "outline", day: null },
    ]);
    expect(getCourse(st, CI)!.artifacts.map((a) => a.id)).not.toContain("a-2");
  });

  it("藍圖升版後要先定稿才能產逐頁腳本；被閘擋住的產檔不會發生", () => {
    const course = getCourse(initialState(), CI)!;
    const revised = run([{ type: "blueprint/revise", courseId: CI, blueprint: course.blueprint, note: "加一則故事" }]);
    const c = getCourse(revised, CI)!;
    expect(c.blueprintHistory.at(-1)).toMatchObject({ version: 4, finalizedAt: null });
    expect(isStale(c, latestArtifact(c, "slides", 1)!)).toBe(true);
    expect(generationGate(c, { kind: "page_script", day: 1 })).toEqual([{ kind: "blueprint_not_finalized", version: 4 }]);

    const blocked = run([{ type: "artifact/request", id: "s-x", courseId: CI, kind: "page_script", day: 1 }], revised);
    expect(getCourse(blocked, CI)!.artifacts.some((a) => a.id === "s-x")).toBe(false);

    const finalized = run([{ type: "blueprint/finalize", courseId: CI }], revised);
    expect(generationGate(getCourse(finalized, CI)!, { kind: "page_script", day: 1 })).toEqual([]);
  });

  it("逐頁腳本定稿後才能產簡報，簡報的上游是那一版腳本", () => {
    let st = run([
      { type: "blueprint/revise", courseId: CI, blueprint: getCourse(initialState(), CI)!.blueprint, note: "x" },
      { type: "blueprint/finalize", courseId: CI },
      { type: "artifact/request", id: "sc-3", courseId: CI, kind: "page_script", day: 1 },
      ...ready(CI, "sc-3"),
    ]);
    expect(generationGate(getCourse(st, CI)!, { kind: "slides", day: 1 })).toEqual([{ kind: "script_not_finalized", day: 1, version: 3 }]);
    st = run([
      { type: "artifact/finalize", courseId: CI, artifactId: "sc-3" },
      { type: "artifact/request", id: "sl-4", courseId: CI, kind: "slides", day: 1 },
      ...ready(CI, "sl-4"),
    ], st);
    const slides = latestArtifact(getCourse(st, CI)!, "slides", 1)!;
    expect(slides).toMatchObject({ id: "sl-4", version: 4, upstreamIds: ["sc-3"] });
    expect(isStale(getCourse(st, CI)!, slides)).toBe(false);
  });

  it("講師修改版排在最新版之後，沿用原本綁定", () => {
    const st = run([{ type: "artifact/uploadEdit", courseId: CI, baseId: "a-ci-outline-2", id: "a-edit" }]);
    expect(latestArtifact(getCourse(st, CI)!, "outline")).toMatchObject({ id: "a-edit", version: 3, editedFromId: "a-ci-outline-2", blueprintVersion: 3 });
  });

  it("課程大綱可以標記已寄給客戶，其他產物不行", () => {
    const st = run([
      { type: "artifact/markSent", courseId: CI, artifactId: "a-ci-outline-2" },
      { type: "artifact/markSent", courseId: CI, artifactId: "a-ci-slides-2" },
    ]);
    const c = getCourse(st, CI)!;
    expect(c.artifacts.find((a) => a.id === "a-ci-outline-2")!.sentToClientAt).toBe("2026-10-08T10:01:00+08:00");
    expect(c.artifacts.find((a) => a.id === "a-ci-slides-2")!.sentToClientAt).toBeNull();
  });
});

describe("發布與學員入口", () => {
  it("發布鎖定每份可發布產物最新的可用版本（不含講師準備單）、全部素材與連結", () => {
    const st = run([
      { type: "link/add", sessionId: "s-ci-1022", label: "Slido", url: "https://slido.com/x" },
      { type: "session/publish", sessionId: "s-ci-1022" },
    ]);
    const pub = getSession(st, "s-ci-1022")!.publication!;
    const course = getCourse(st, CI)!;
    expect(pub.artifactIds.map((id) => course.artifacts.find((a) => a.id === id)!.kind)).not.toContain("prep_sheet");
    expect(pub.artifactIds).toContain("a-ci-slides-3");
    expect(pub.links).toEqual([{ label: "Slido", url: "https://slido.com/x" }]);
    expect(portalView(st, "a1022", st.now)!.state).toBe("open");
  });

  it("重新產出後學員仍看舊版，重新發布才更新", () => {
    const st1 = run([
      { type: "artifact/request", id: "hb-2", courseId: CI, kind: "handbook", day: null },
      ...ready(CI, "hb-2"),
    ]);
    expect(portalView(st1, "a1015", st1.now)!.artifacts.map((a) => a.id)).toContain("a-ci-handbook-1");
    expect(readiness(st1, getSession(st1, "s-ci-1015")!).map((i) => i.kind)).toContain("publication_outdated");
    const st2 = run([{ type: "session/publish", sessionId: "s-ci-1015" }], st1);
    expect(portalView(st2, "a1015", st2.now)!.artifacts.map((a) => a.id)).toContain("hb-2");
  });

  it("提前關閉立即生效；重新打開、重新發布都會恢復", () => {
    const closed = run([{ type: "portal/close", sessionId: "s-ci-1015" }]);
    expect(portalState(getSession(closed, "s-ci-1015")!, closed.now)).toBe("closed");
    const reopened = run([{ type: "portal/reopen", sessionId: "s-ci-1015" }], closed);
    expect(portalState(getSession(reopened, "s-ci-1015")!, reopened.now)).toBe("open");
    const republished = run([{ type: "session/publish", sessionId: "s-ci-1015" }], closed);
    expect(portalState(getSession(republished, "s-ci-1015")!, republished.now)).toBe("open");
  });

  it("延長期限從目前的到期日往後加", () => {
    const st = run([{ type: "portal/extend", sessionId: "s-ci-1015", days: 14 }]);
    expect(getSession(st, "s-ci-1015")!.portal.expiresAtOverride).toBe("2026-11-28T16:00:00+08:00");
  });
});

describe("從零開一門課到準備好", () => {
  it("新專案 → 新課程（模組卡＋產業素材包）→ 談完、定稿、產完整條鏈、上傳素材、場次排好、發布", () => {
    let st = run([
      {
        type: "project/create",
        id: "p-x",
        title: "D 公司",
        priceTwd: 50000,
        status: "negotiating",
        clientContext: { company: "D 公司", industry: "零售", goal: "門市主管會用 AI 回覆客訴", industryPackId: "ip-manufacturing", itConstraints: ["只能用瀏覽器"], brand: null },
      },
      { type: "course/create", id: "c-x", projectId: "p-x", title: "Claude 門市入門", moduleIds: ["A1", "B2"], totalHours: 6, industryPackId: "ip-manufacturing" },
      {
        type: "session/create",
        id: "s-x",
        courseId: "c-x",
        days: [newSessionDay("2026-12-01T09:00:00+08:00", "2026-12-01T16:00:00+08:00")],
        portalCode: "zz9",
      },
    ]);
    const course = getCourse(st, "c-x")!;
    expect(course.source).toEqual({ moduleIds: ["A1", "B2"], industryPackId: "ip-manufacturing" });
    expect(course.blueprint.constraints).toContain("只能用瀏覽器");
    const kinds = () => readiness(st, getSession(st, "s-x")!).map((i) => i.kind);
    expect(kinds()).toEqual(expect.arrayContaining(["open_items", "missing_elements", "units_need_work", "artifact_missing", "no_materials", "no_links", "venue_unset", "unpublished"]));

    const bp = course.blueprint;
    const done = BlueprintSchema.parse({
      ...bp,
      elements: { theory: ["a"], handsOn: ["b"], takeaway: ["c"], quote: ["d"], story: ["e"] },
      openQuestions: [],
      days: bp.days.map((d) => ({ ...d, slots: d.slots.map((s) => ({ ...s, units: s.units.map((u) => ({ ...u, reuse: "reuse" })) })) })),
    });
    st = run(
      [
        { type: "blueprint/revise", courseId: "c-x", blueprint: done, note: "補齊" },
        { type: "blueprint/finalize", courseId: "c-x" },
        { type: "artifact/request", id: "x-outline", courseId: "c-x", kind: "outline", day: null },
        ...ready("c-x", "x-outline"),
        { type: "artifact/request", id: "x-prep", courseId: "c-x", kind: "prep_sheet", day: null },
        ...ready("c-x", "x-prep"),
        { type: "artifact/request", id: "x-script", courseId: "c-x", kind: "page_script", day: 1 },
        ...ready("c-x", "x-script"),
        { type: "artifact/finalize", courseId: "c-x", artifactId: "x-script" },
        { type: "artifact/request", id: "x-slides", courseId: "c-x", kind: "slides", day: 1 },
        ...ready("c-x", "x-slides"),
        { type: "artifact/request", id: "x-hb", courseId: "c-x", kind: "handbook", day: null },
        ...ready("c-x", "x-hb"),
        { type: "material/add", id: "m-x", courseId: "c-x", name: "練習檔.xlsx", sizeKb: 20 },
        { type: "link/add", sessionId: "s-x", label: "Slido", url: "https://slido.com/y" },
        { type: "session/updateDays", sessionId: "s-x", days: [newSessionDay("2026-12-01T09:00:00+08:00", "2026-12-01T16:00:00+08:00", "台北教室")] },
        { type: "session/publish", sessionId: "s-x" },
      ],
      st,
    );
    expect(readiness(st, getSession(st, "s-x")!)).toEqual([]);
  });

  it("沒有模組時從零開始：來源為 null、單元都是新做，預設歸在 B1 流程診斷", () => {
    const st = run([{ type: "course/create", id: "c-z", projectId: "p-a-2026", title: "新課", moduleIds: [], totalHours: 6, industryPackId: null }]);
    const c = getCourse(st, "c-z")!;
    expect(c.source).toBeNull();
    expect(c.blueprint.days[0].slots[0].units.every((u) => u.reuse === "new" && u.source === null && u.module === "B1" && u.level === null)).toBe(true);
  });

  it("起始藍圖通過 schema，單元依模組卡骨架出生、來源是對應的單元卡、屬於該模組、要改", () => {
    const st = initialState();
    const card = getModuleCard(st, "A1")!;
    const bp = starterBlueprint({
      title: "t",
      clientContext: st.projects[0].clientContext,
      moduleCards: [card],
      unitCards: st.unitCards,
      industryPack: getIndustryPack(st, "ip-manufacturing"),
    });
    const units = bp.days.flatMap((d) => d.slots.flatMap((s) => s.units));
    expect(units.map((u) => u.title)).toEqual(card.skeletonUnitIds.map((id) => getUnitCard(st, id)!.title));
    expect(units.map((u) => u.source)).toEqual(
      card.skeletonUnitIds.map((id) => ({ kind: "unit_card", id, version: null, unit: getUnitCard(st, id)!.title })),
    );
    expect(units.every((u) => u.reuse === "modify" && u.module === "A1" && u.level === null)).toBe(true);
    expect(bp.days[0].theme).toBe("A1 通用生成 AI");
  });

  it("模組卡的骨架單元查不到單元卡時退回預設單元，且不記來源", () => {
    const st = initialState();
    const bp = starterBlueprint({ title: "t", clientContext: st.projects[0].clientContext, moduleCards: [getModuleCard(st, "A2")!], unitCards: [] });
    const units = bp.days.flatMap((d) => d.slots.flatMap((s) => s.units));
    expect(units.map((u) => u.title)).toEqual(["開場與需求盤點", "待規劃"]);
    expect(units.every((u) => u.reuse === "new" && u.source === null && u.module === "A2")).toBe(true);
  });

  it("course/create 帶模組：單元依骨架出生，來源記下模組與產業素材包", () => {
    const st = run([{ type: "course/create", id: "c-z", projectId: "p-a-2026", title: "新課", moduleIds: ["A4"], totalHours: 6, industryPackId: "ip-finance-approval" }]);
    const c = getCourse(st, "c-z")!;
    expect(c.source).toEqual({ moduleIds: ["A4"], industryPackId: "ip-finance-approval" });
    expect(c.blueprintHistory[0].note).toBe("從模組卡「A4 雲端自動化」v2 複製出生");
    const units = c.blueprint.days.flatMap((d) => d.slots.flatMap((s) => s.units));
    expect(units.map((u) => u.title)).toEqual(["雲端流程上手", "表單觸發器", "逾期提醒", "寄送前的安全網"]);
    expect(units.every((u) => u.reuse === "modify" && u.module === "A4" && u.source?.kind === "unit_card")).toBe(true);
    expect(units.map((u) => u.source?.id)).toEqual(["uc-a4-cloud-first", "uc-a4-form-trigger", "uc-a4-overdue", "uc-a4-safety-net"]);
  });

  it("選多個模組：單元依模組順序（A 在前、B 在後）接續各模組卡的骨架，來源是對應單元卡、module 是所屬模組", () => {
    // 刻意亂序傳入，順序以模組代號為準，不看選的先後
    const st = run([{ type: "course/create", id: "c-m", projectId: "p-a-2026", title: "多模組", moduleIds: ["B1", "A4", "A1"], totalHours: 6, industryPackId: "ip-finance-approval" }]);
    const c = getCourse(st, "c-m")!;
    expect(c.source).toEqual({ moduleIds: ["A1", "A4", "B1"], industryPackId: "ip-finance-approval" });
    const units = c.blueprint.days.flatMap((d) => d.slots.flatMap((s) => s.units));
    const expectedIds = (["A1", "A4", "B1"] as const).flatMap((m) => getModuleCard(st, m)!.skeletonUnitIds);
    expect(units.map((u) => u.source)).toEqual(expectedIds.map((id) => ({ kind: "unit_card", id, version: null, unit: getUnitCard(st, id)!.title })));
    expect(units.map((u) => u.module)).toEqual(expectedIds.map((id) => getUnitCard(st, id)!.moduleId));
    expect(c.blueprintHistory[0].note).toBe("從模組卡「A1 通用生成 AI」v2、「A4 雲端自動化」v2、「B1 流程診斷」v1 複製出生");
  });

  describe("總時數決定藍圖的時段與天數（時段一律 180 分鐘，一天兩段）", () => {
    const build = (moduleIds: ModuleId[], hours: number) => {
      const st = run([{ type: "course/create", id: "c-h", projectId: "p-a-2026", title: "t", moduleIds, totalHours: hours, industryPackId: null }]);
      const bp = getCourse(st, "c-h")!.blueprint;
      const slots = bp.days.flatMap((d) => d.slots);
      const units = slots.flatMap((s) => s.units);
      return { bp, slots, units, placeholders: units.filter((u) => u.source === null && u.title === "待規劃") };
    };

    it.each([
      ["12H 單一模組（A1 三個單元）", ["A1"], 12, 4, 1],
      ["12H 沒有選模組", [], 12, 4, 3],
      ["30H 只有幾個單元", ["A5", "B4"], 30, 10, 7],
      ["6H", ["A1", "B1"], 6, 2, 0],
    ] as [string, ModuleId[], number, number, number][])("%s：每段 180、天數 = ceil(時數/6)、總長 = 時數×60、只在需要時補待規劃", (_n, ids, hours, slotCount, placeholderCount) => {
      const { bp, slots, placeholders } = build(ids, hours);
      expect(slots).toHaveLength(slotCount);
      expect(slots.every((s) => s.minutes === 180)).toBe(true);
      expect(bp.days).toHaveLength(Math.ceil(hours / 6));
      expect(totalMinutes(bp)).toBe(hours * 60);
      expect(slots.every((s) => plannedMinutes(s) === s.minutes)).toBe(true);
      expect(placeholders).toHaveLength(placeholderCount);
    });

    it("2H 短講座：一段、長度就是 120 分鐘；3H 是一段 180", () => {
      const short = build(["A1", "B1"], 2);
      expect(short.slots.map((s) => s.minutes)).toEqual([120]);
      expect(plannedMinutes(short.slots[0])).toBe(120);
      expect(build(["A1"], 3).slots.map((s) => s.minutes)).toEqual([180]);
    });

    it("待規劃單元：schema 合法、不記來源、標成新做，模組沿用前一個單元", () => {
      const { units, placeholders } = build(["A1"], 12);
      expect(placeholders).toHaveLength(1);
      const p = placeholders[0];
      expect(p.reuse).toBe("new");
      expect(p.module).toBe(units[units.indexOf(p) - 1].module);
    });
  });

  it("沒有選模組時從零開始，總時數仍照所選", () => {
    const st = run([{ type: "course/create", id: "c-s", projectId: "p-a-2026", title: "t", moduleIds: [], totalHours: 3, industryPackId: null }]);
    expect(totalMinutes(getCourse(st, "c-s")!.blueprint)).toBe(180);
  });
});

describe("專案與客戶文件", () => {
  it("新增客戶文件收在專案底下", () => {
    const st = run([{ type: "clientDocument/add", projectId: "p-a-2026", id: "doc-new", kind: "feedback", title: "回饋", fileName: "回饋.eml" }]);
    expect(st.projects[0].clientDocuments.at(-1)).toMatchObject({ id: "doc-new", receivedAt: st.now });
  });
});

describe("知識庫草稿", () => {
  it("模組卡升版：多一版（記下改了什麼與來源課程），草稿消失", () => {
    const st = run([{ type: "draft/accept", draftId: "d-pa-module-card", newId: "" }]);
    const card = getModuleCard(st, "A4")!;
    expect(card.versions).toHaveLength(3);
    expect(card.versions.at(-1)).toMatchObject({ version: 3, fromCourseId: "c-pa-finance" });
    expect(card.versions.at(-1)!.note).toContain("逾期提醒");
    expect(st.drafts.map((d) => d.id)).not.toContain("d-pa-module-card");
  });

  it("收進產業素材包、捨棄", () => {
    const st = run([{ type: "draft/accept", draftId: "d-pa-pack", newId: "ip-new" }]);
    expect(getIndustryPack(st, "ip-new")).toMatchObject({ title: "金融業：月結對帳", industry: "金融" });
    expect(st.drafts.map((d) => d.id)).not.toContain("d-pa-pack");
    expect(run([{ type: "draft/discard", draftId: "d-pa-pack" }]).drafts).toHaveLength(1);
  });

  it("匯入講義產生的課程配方草稿，收進後單元卡依序編號、屬於各自的模組，配方引用它們", () => {
    const st = run([
      {
        type: "draft/import",
        id: "d-imp",
        fileName: "2025 行政班講義.pdf",
        proposal: {
          kind: "new_course_recipe",
          recipe: { title: "試算表自動化", client: "匯入的講義", status: "delivered", heldOn: null, industry: "通用", audience: "待確認", tools: [] },
          unitCards: [
            { moduleId: "A2", title: "甲", minutes: 60, objective: "o", method: "m", outcome: "r" },
            { moduleId: "B3", title: "乙", minutes: 90, objective: "o", method: "m", outcome: "r" },
          ],
        },
      },
      { type: "draft/accept", draftId: "d-imp", newId: "rc-imp" },
    ]);
    const recipe = getRecipe(st, "rc-imp")!;
    expect(recipe).toMatchObject({ title: "試算表自動化", status: "delivered" });
    expect(recipe.unitIds).toEqual(["rc-imp-u1", "rc-imp-u2"]);
    expect(recipeUnitCards(st, recipe).map((u) => [u.id, u.moduleId, u.title])).toEqual([
      ["rc-imp-u1", "A2", "甲"],
      ["rc-imp-u2", "B3", "乙"],
    ]);
    expect(st.drafts.map((d) => d.id)).not.toContain("d-imp");
  });
});
