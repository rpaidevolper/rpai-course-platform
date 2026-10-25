import { BlueprintSchema, type Blueprint, type Unit } from "./schema";

/** 測試用的單元：預設有動手環節、出自單元卡、沿用。 */
export function sampleUnit(title: string, minutes: number, overrides: Partial<Unit> = {}): Unit {
  return {
    title,
    minutes,
    module: "A1",
    level: "L2",
    objective: `完成「${title}」的練習`,
    method: "示範後分組實作",
    outcome: `一份「${title}」的成品`,
    keyPoints: ["重點一"],
    activity: "用自己的資料做一次",
    elements: ["handsOn"],
    carriesFrom: null,
    source: { kind: "unit_card", id: "uc-weekly-report", version: null, unit: title },
    reuse: "reuse",
    ...overrides,
  };
}

/**
 * 測試用的完整藍圖：兩天、每天上午下午各一個 180 分鐘時段，單元分鐘數剛好加滿，五元素齊全、沒有待確認事項。
 * 第 2 天全是純講述單元（沒有動手環節）。內容是虛構的。
 */
export function sampleBlueprint(overrides: Partial<Blueprint> = {}): Blueprint {
  const lecture = { activity: null, elements: ["theory" as const] };
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
    format: { mode: "workshop", venue: null },
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
    days: [
      {
        theme: "把自己的週報交給 AI",
        slots: [
          { label: "上午", minutes: 180, units: [sampleUnit("週報拆解", 60), sampleUnit("第一份草稿", 120)] },
          { label: "下午", minutes: 180, units: [sampleUnit("檢查與修正", 90), sampleUnit("做成範本", 90)] },
        ],
      },
      {
        theme: "把範本推給整個部門",
        slots: [
          { label: "上午", minutes: 180, units: [sampleUnit("部門導入的阻力", 180, lecture)] },
          { label: "下午", minutes: 180, units: [sampleUnit("維護與治理", 180, lecture)] },
        ],
      },
    ],
    constraints: ["教室只有投影機"],
    tools: [{ name: "ChatGPT", plan: "free", confirmedWithClient: true }],
    openQuestions: [],
    ...overrides,
  });
}
