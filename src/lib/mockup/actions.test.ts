import { describe, expect, it } from "vitest";
import { BlueprintSchema } from "@/lib/blueprint/schema";
import { addMs, demoReducer, newSessionDay, starterBlueprint, type DemoAction } from "./actions";
import { generationGate, getCourse, getSession, isStale, latestArtifact, portalState, portalView, readiness } from "./logic";
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
  it("新專案 → 新課程（框架＋情境）→ 談完、定稿、產完整條鏈、上傳素材、場次排好、發布", () => {
    let st = run([
      {
        type: "project/create",
        id: "p-x",
        title: "D 公司",
        priceTwd: 50000,
        status: "negotiating",
        clientContext: { company: "D 公司", industry: "零售", goal: "門市主管會用 AI 回覆客訴", scenarioId: "sc-manufacturing", itConstraints: ["只能用瀏覽器"], brand: null },
      },
      { type: "course/create", id: "c-x", projectId: "p-x", title: "Claude 門市入門", frameworkId: "fw-claude-intro", scenarioId: "sc-manufacturing" },
      {
        type: "session/create",
        id: "s-x",
        courseId: "c-x",
        days: [newSessionDay("2026-12-01T09:00:00+08:00", "2026-12-01T16:00:00+08:00")],
        portalCode: "zz9",
      },
    ]);
    const course = getCourse(st, "c-x")!;
    expect(course.source).toEqual({ frameworkId: "fw-claude-intro", frameworkVersion: 2, scenarioId: "sc-manufacturing" });
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

  it("沒有框架時從零開始：來源為 null、單元都是新做", () => {
    const st = run([{ type: "course/create", id: "c-z", projectId: "p-a-2026", title: "新課", frameworkId: null, scenarioId: null }]);
    const c = getCourse(st, "c-z")!;
    expect(c.source).toBeNull();
    expect(c.blueprint.days[0].slots[0].units.every((u) => u.reuse === "new" && u.source === null)).toBe(true);
  });

  it("起始藍圖通過 schema，單元標示來自框架、要改", () => {
    const st = initialState();
    const bp = starterBlueprint({ title: "t", clientContext: st.projects[0].clientContext, framework: st.frameworks[0], scenario: st.scenarios[0] });
    const units = bp.days.flatMap((d) => d.slots.flatMap((s) => s.units));
    expect(units.map((u) => u.title)).toEqual(st.frameworks[0].moduleTitles);
    expect(units.every((u) => u.reuse === "modify" && u.source?.kind === "framework")).toBe(true);
  });
});

describe("專案與客戶文件", () => {
  it("新增客戶文件收在專案底下", () => {
    const st = run([{ type: "clientDocument/add", projectId: "p-a-2026", id: "doc-new", kind: "feedback", title: "回饋", fileName: "回饋.eml" }]);
    expect(st.projects[0].clientDocuments.at(-1)).toMatchObject({ id: "doc-new", receivedAt: st.now });
  });
});

describe("知識庫草稿", () => {
  it("升版：框架多一版、草稿消失", () => {
    const st = run([{ type: "draft/accept", draftId: "d-pa-framework", newId: "" }]);
    const fw = st.frameworks.find((f) => f.id === "fw-pa-basics")!;
    expect(fw.versions.at(-1)).toMatchObject({ version: 3, fromCourseId: "c-pa-finance" });
    expect(st.drafts.map((d) => d.id)).not.toContain("d-pa-framework");
  });

  it("另存成新框架：原框架不變", () => {
    const st = run([{ type: "draft/saveAsFramework", draftId: "d-pa-framework", frameworkId: "fw-new", title: "簽核進階" }]);
    expect(st.frameworks.find((f) => f.id === "fw-pa-basics")!.versions).toHaveLength(2);
    expect(st.frameworks.find((f) => f.id === "fw-new")).toMatchObject({ title: "簽核進階", topicId: "power-automate" });
  });

  it("收進情境、捨棄", () => {
    const st = run([{ type: "draft/accept", draftId: "d-pa-scenario", newId: "sc-new" }]);
    expect(st.scenarios.find((s) => s.id === "sc-new")?.title).toBe("金融業：月結對帳");
    expect(run([{ type: "draft/discard", draftId: "d-pa-scenario" }]).drafts).toHaveLength(1);
  });

  it("匯入講義產生沒有來源課程的草稿，收進後變成新框架", () => {
    const st = run([
      {
        type: "draft/import",
        id: "d-imp",
        fileName: "2025 行政班講義.pdf",
        proposal: { kind: "new_framework", framework: { topicId: "gas", title: "試算表自動化", summary: "s", moduleTitles: ["一", "二"] } },
      },
      { type: "draft/accept", draftId: "d-imp", newId: "fw-imp" },
    ]);
    expect(st.frameworks.find((f) => f.id === "fw-imp")!.versions[0].note).toContain("2025 行政班講義.pdf");
  });
});
