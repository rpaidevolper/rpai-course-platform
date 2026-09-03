import { describe, expect, it } from "vitest";
import {
  BlueprintSchema,
  checkBlueprint,
  missingElements,
  plannedMinutes,
  type Blueprint,
} from "./schema";

function sampleBlueprint(overrides: Partial<Blueprint> = {}): Blueprint {
  return BlueprintSchema.parse({
    title: "用 AI 工具把週報時間砍一半",
    oneLiner: "教行政人員用現成 AI 工具處理重複性文書工作",
    audience: {
      who: "中小企業行政與業務助理",
      size: 20,
      priorKnowledge: "會用 Word/Excel，沒用過任何 AI 工具",
      painPoints: ["每週花三小時整理週報", "不知道 AI 工具能不能信"],
    },
    outcomes: ["能用 AI 在十分鐘內整理出一份週報草稿"],
    format: { durationMinutes: 120, mode: "workshop", venue: null },
    narrative: {
      model: "SCQA",
      arc: ["現況：週報吃掉半天", "衝突：AI 很多但不知從何下手", "方案：三步驟", "決議：帶回去馬上用"],
    },
    elements: {
      theory: ["AI 工具三分類"],
      handsOn: ["用自己的週報練一次"],
      takeaway: ["週報 prompt 範本"],
      quote: ["工具不是重點，流程才是"],
      story: ["某會計事務所把月結從三天縮到一天"],
    },
    modules: [
      {
        title: "為什麼是現在",
        minutes: 30,
        objective: "說出自己工作中三個可以交給 AI 的任務",
        keyPoints: ["AI 工具分類", "適合與不適合的任務"],
        activity: null,
        elements: ["theory", "story"],
      },
      {
        title: "動手做週報",
        minutes: 90,
        objective: "用範本產出一份自己的週報草稿",
        keyPoints: ["prompt 結構", "檢查與修正"],
        activity: "帶自己的資料實作",
        elements: ["handsOn", "takeaway", "quote"],
      },
    ],
    constraints: ["教室只有投影機，沒有網路白名單問題"],
    openQuestions: [],
    ...overrides,
  });
}

describe("BlueprintSchema", () => {
  it("接受完整的藍圖", () => {
    expect(() => sampleBlueprint()).not.toThrow();
  });

  it("拒絕沒有學習成果的藍圖", () => {
    expect(() => sampleBlueprint({ outcomes: [] })).toThrow();
  });
});

describe("checkBlueprint", () => {
  it("完整藍圖沒有問題", () => {
    expect(checkBlueprint(sampleBlueprint())).toEqual([]);
  });

  it("找出缺少的元素", () => {
    const bp = sampleBlueprint();
    bp.elements.story = [];
    bp.elements.quote = [];
    expect(missingElements(bp)).toEqual(["quote", "story"]);
    expect(checkBlueprint(bp)).toContainEqual({
      kind: "missing_element",
      element: "story",
    });
  });

  it("單元時間加總與課程長度不符時提示", () => {
    const bp = sampleBlueprint();
    bp.format.durationMinutes = 180;
    expect(plannedMinutes(bp)).toBe(120);
    expect(checkBlueprint(bp)).toContainEqual({
      kind: "duration_mismatch",
      planned: 120,
      expected: 180,
    });
  });

  it("未確認事項逐條列出", () => {
    const bp = sampleBlueprint({ openQuestions: ["場地有沒有 Wi-Fi"] });
    expect(checkBlueprint(bp)).toEqual([
      { kind: "open_question", question: "場地有沒有 Wi-Fi" },
    ]);
  });
});
