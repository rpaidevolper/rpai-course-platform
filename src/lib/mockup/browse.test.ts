import { describe, expect, it } from "vitest";
import { filterRecipes, filterUnitCards, moduleCardUsage, noFilter, unitCardUsage, type KnowledgeFilter } from "./browse";
import { latestBlueprintVersion } from "./logic";
import { initialState } from "./state";

const st = initialState();
const f = (patch: Partial<KnowledgeFilter>): KnowledgeFilter => ({ ...noFilter(), ...patch });
const tags = (patch: Partial<KnowledgeFilter["tags"]>) => f({ tags: { ...noFilter().tags, ...patch } });
const unitIds = (filter: KnowledgeFilter) => filterUnitCards(st, filter).map((u) => u.id);
const recipeIds = (filter: KnowledgeFilter) => filterRecipes(st, filter).map((r) => r.id);

describe("沒有任何條件", () => {
  it("單元卡與課程配方原樣全部列出，順序不變", () => {
    expect(unitIds(noFilter())).toEqual(st.unitCards.map((u) => u.id));
    expect(recipeIds(noFilter())).toEqual(st.recipes.map((r) => r.id));
  });
});

describe("依模組篩選", () => {
  it("單元卡：只留下屬於所選模組的；多個模組取聯集", () => {
    expect(unitIds(f({ moduleIds: ["A5"] }))).toEqual(["uc-a5-skill", "uc-a5-tool"]);
    expect(unitIds(f({ moduleIds: ["A5", "B4"] }))).toEqual(["uc-a5-skill", "uc-a5-tool", "uc-b4-monthly-cost"]);
  });
  it("課程配方：至少用到所選模組一張單元卡就留下", () => {
    expect(recipeIds(f({ moduleIds: ["A5"] }))).toEqual(["rc-j-agent"]);
    expect(recipeIds(f({ moduleIds: ["A2"] }))).toEqual(["rc-k-kb-2605"]);
  });
});

describe("依標籤篩選", () => {
  it("同一組內多選是 OR", () => {
    expect(unitIds(tags({ tools: ["Claude Code", "NotebookLM"] }))).toEqual(["uc-a2-handbook", "uc-a2-cited", "uc-a5-skill", "uc-a5-tool"]);
  });
  it("不同組之間是 AND", () => {
    // 對象含種子團隊，而且工具含 Claude Skills
    expect(unitIds(tags({ audiences: ["種子團隊"], tools: ["Claude Skills"] }))).toEqual(["uc-a5-skill"]);
    expect(unitIds(tags({ audiences: ["品保"], tools: ["Claude Code"] }))).toEqual([]);
  });
  it("模組與標籤也是 AND", () => {
    expect(unitIds(f({ moduleIds: ["B1"], tags: { ...noFilter().tags, audiences: ["種子團隊"] } }))).toEqual(["uc-b1-dept"]);
  });
  it("單元卡的產業由用過它的課程配方推得", () => {
    // 流程盤點被 H（HR）、L（製造）、J（製造）三份配方用過
    expect(unitIds(tags({ industries: ["HR"] }))).toContain("uc-b1-inventory");
    expect(unitIds(tags({ industries: ["教育"] }))).toEqual([]);
  });
  it("課程配方用自己存的標籤", () => {
    expect(recipeIds(tags({ industries: ["金融"] }))).toEqual(["rc-g-pa-2601", "rc-m-governance"]);
    expect(recipeIds(tags({ industries: ["金融"], scenarios: ["知識整理"] }))).toEqual(["rc-m-governance"]);
  });
  it("規格只篩課程配方（由總時數推得）；單元卡沒有規格，不受影響", () => {
    // M 治理半日課 60+60+50=170 分 → 短講座；K 講座 90+60+60=210 分 → 半日
    expect(recipeIds(f({ specs: ["短講座"] }))).toContain("rc-m-governance");
    expect(recipeIds(f({ specs: ["半日"] }))).toContain("rc-k-kb-2605");
    expect(recipeIds(f({ specs: ["長期班"] }))).toEqual([]);
    expect(unitIds(f({ specs: ["長期班"] }))).toEqual(st.unitCards.map((u) => u.id));
  });
});

describe("關鍵字搜尋", () => {
  it("比對單元卡的標題、目標、教學方式、成果", () => {
    expect(unitIds(f({ keyword: "第一支" }))).toEqual(["uc-a4-first-script"]); // 標題
    expect(unitIds(f({ keyword: "逾期三天" }))).toEqual(["uc-a4-overdue"]); // 目標
    expect(unitIds(f({ keyword: "找碴" }))).toEqual(["uc-a4-safety-net"]); // 教學方式
    expect(unitIds(f({ keyword: "每月成本試算表" }))).toEqual(["uc-b4-monthly-cost"]); // 成果
  });
  it("也比對標籤與模組名稱", () => {
    expect(unitIds(f({ keyword: "NotebookLM" }))).toEqual(["uc-a2-handbook", "uc-a2-cited"]);
    expect(unitIds(f({ keyword: "成本節費" }))).toEqual(["uc-b4-monthly-cost"]);
  });
  it("課程配方比對標題、客戶、模組名稱、單元標題與標籤", () => {
    expect(recipeIds(f({ keyword: "簽核自動化" }))).toEqual(["rc-g-pa-2601"]); // 標題
    expect(recipeIds(f({ keyword: "H 公司" }))).toEqual(["rc-h-gas-2602"]); // 客戶
    expect(recipeIds(f({ keyword: "Agent 與 AI 編碼" }))).toEqual(["rc-j-agent"]); // 模組名稱
    expect(recipeIds(f({ keyword: "逾期提醒" }))).toEqual(["rc-g-pa-2601"]); // 單元標題
    expect(recipeIds(f({ keyword: "金融" }))).toEqual(["rc-g-pa-2601", "rc-m-governance"]); // 標籤
  });
  it("不分大小寫，全形半形視為相同", () => {
    expect(unitIds(f({ keyword: "第一支 apps script" }))).toEqual(["uc-a4-first-script"]);
    expect(unitIds(f({ keyword: "第一支　ＡＰＰＳ　ＳＣＲＩＰＴ" }))).toEqual(["uc-a4-first-script"]);
  });
  it("前後空白忽略；全是空白等於沒有關鍵字", () => {
    expect(unitIds(f({ keyword: "  逾期三天  " }))).toEqual(["uc-a4-overdue"]);
    expect(unitIds(f({ keyword: "   " }))).toEqual(st.unitCards.map((u) => u.id));
  });
  it("以空白分隔的多個詞要全部出現（AND），不必相鄰、順序不拘", () => {
    expect(unitIds(f({ keyword: "Claude 文書" })).length).toBeGreaterThan(0);
    expect(unitIds(f({ keyword: "逾期 Teams" }))).toEqual(["uc-a4-overdue"]);
    expect(unitIds(f({ keyword: "Teams 逾期" }))).toEqual(["uc-a4-overdue"]);
    expect(unitIds(f({ keyword: "逾期 NotebookLM" }))).toEqual([]);
  });
  it("找不到就是空陣列", () => {
    expect(unitIds(f({ keyword: "完全不存在的字串" }))).toEqual([]);
    expect(recipeIds(f({ keyword: "完全不存在的字串" }))).toEqual([]);
  });
  it("不改動傳入的狀態", () => {
    const before = JSON.stringify(st);
    filterUnitCards(st, f({ keyword: "Claude", moduleIds: ["A1"] }));
    filterRecipes(st, f({ keyword: "Claude", specs: ["半日"] }));
    expect(JSON.stringify(st)).toBe(before);
  });
});

describe("條件組合", () => {
  it("模組 + 標籤 + 關鍵字一起用，全部要符合", () => {
    const filter = f({ moduleIds: ["A4"], keyword: "提醒", tags: { ...noFilter().tags, audiences: ["部門主管"] } });
    expect(unitIds(filter)).toEqual(["uc-a4-overdue"]);
    expect(unitIds({ ...filter, keyword: "核准" })).toEqual([]);
  });
});

describe("用過的課程（由藍圖推得，不另存）", () => {
  it("單元卡：最新藍圖裡 source 指向這張卡的單元，附藍圖版本與單元標題", () => {
    const usage = unitCardUsage(st, "uc-b2-four-parts");
    const intro = usage.find((u) => u.course.id === "c-claude-intro");
    expect(intro).toBeDefined();
    expect(intro!.blueprintVersion).toBe(latestBlueprintVersion(intro!.course));
    expect(intro!.unitTitles).toEqual(["提示詞的四個零件"]);
  });
  it("沒有課程用過的單元卡回空陣列", () => {
    expect(unitCardUsage(st, "uc-a5-skill")).toEqual([]);
  });
  it("source 是另一門課程（kind course）的單元不算用過單元卡", () => {
    // 進階班的單元複製自入門班，不是直接取自單元卡
    const ids = unitCardUsage(st, "uc-b2-four-parts").map((u) => u.course.id);
    expect(ids).not.toContain("c-claude-advanced");
  });
  it("模組卡：最新藍圖有單元屬於該模組的課程，附單元數", () => {
    const usage = moduleCardUsage(st, "B2");
    expect(usage.length).toBeGreaterThan(0);
    for (const u of usage) {
      expect(u.blueprintVersion).toBe(latestBlueprintVersion(u.course));
      expect(u.unitTitles.length).toBeGreaterThan(0);
    }
    expect(moduleCardUsage(st, "A5")).toEqual([]);
  });
  it("藍圖單元改了，用過的課程跟著變（不存在別處）", () => {
    const next = structuredClone(st);
    const course = next.courses.find((c) => c.id === "c-claude-intro")!;
    for (const d of course.blueprint.days) for (const s of d.slots) for (const u of s.units) if (u.source?.id === "uc-b2-four-parts") u.source = null;
    expect(unitCardUsage(next, "uc-b2-four-parts").map((u) => u.course.id)).not.toContain("c-claude-intro");
  });
});
