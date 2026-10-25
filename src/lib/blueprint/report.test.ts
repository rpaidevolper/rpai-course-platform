import { describe, expect, it } from "vitest";
import { blueprintReport } from "./report";
import { sampleBlueprint } from "./testing";

/** sampleBlueprint 的第 2 天兩個單元都是純講述，這是它唯一的問題。 */
const LECTURE_ISSUES = [
  "第 2 天上午「部門導入的阻力」是純講述單元，沒有動手環節。",
  "第 2 天下午「維護與治理」是純講述單元，沒有動手環節。",
];

describe("blueprintReport", () => {
  it("完整的藍圖只剩第 2 天兩個純講述單元要注意，總時長是 720 分鐘", () => {
    expect(blueprintReport(sampleBlueprint())).toEqual({
      total_minutes: 720,
      missing_elements: [],
      issues: LECTURE_ISSUES,
      open_items: [],
    });
  });

  it("缺的五元素依五元素順序列出，並寫進 issues", () => {
    const bp = sampleBlueprint();
    bp.elements.story = [];
    bp.elements.quote = [];

    const report = blueprintReport(bp);
    expect(report.missing_elements).toEqual(["金句", "故事"]);
    expect(report.issues).toEqual(["五元素缺「金句」。", "五元素缺「故事」。", ...LECTURE_ISSUES]);
  });

  it("分鐘數對不上時寫出單元加總與時段長度，總時長以時段為準", () => {
    const bp = sampleBlueprint();
    bp.days[0].slots[0].minutes = 200;

    const report = blueprintReport(bp);
    expect(report.issues).toContain("第 1 天上午：單元加起來 180 分鐘，但時段是 200 分鐘。");
    expect(report.total_minutes).toBe(740);
  });

  it("要改與新做的單元各自寫一句要準備", () => {
    const bp = sampleBlueprint();
    bp.days[0].slots[0].units[0].reuse = "modify";
    bp.days[0].slots[1].units[1].reuse = "new";

    expect(blueprintReport(bp).issues).toEqual([
      "第 1 天上午「週報拆解」要改，還要準備。",
      "第 1 天下午「做成範本」新做，還要準備。",
      ...LECTURE_ISSUES,
    ]);
  });

  it("應用層級還沒評（null）要提醒；純方法（na）不算", () => {
    const bp = sampleBlueprint();
    bp.days[0].slots[0].units[0].level = null;
    bp.days[0].slots[0].units[1].level = "na";

    expect(blueprintReport(bp).issues).toEqual(["第 1 天上午「週報拆解」的應用層級還沒評。", ...LECTURE_ISSUES]);
  });

  it("待確認事項與未確認的工具進 open_items，不進 issues", () => {
    const bp = sampleBlueprint({
      openQuestions: [{ text: "場地有沒有投影機？", audience: "client", unit: "第一份草稿" }],
      tools: [{ name: "Copilot", plan: "enterprise", confirmedWithClient: false }],
    });

    const report = blueprintReport(bp);
    expect(report.open_items).toEqual([
      { text: "場地有沒有投影機？", audience: "client", unit: "第一份草稿", tool: null },
      { text: "學員是否都能使用 Copilot（企業版）？", audience: "client", unit: null, tool: "Copilot" },
    ]);
    expect(report.issues).toEqual(LECTURE_ISSUES);
  });
});
