import { describe, expect, it } from "vitest";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import {
  BlueprintSchema,
  checkBlueprint,
  missingElements,
  totalMinutes,
  type Blueprint,
  type Unit,
} from "./schema";

const unit = (title: string, minutes: number, carriesFrom: string | null = null) => ({
  title,
  minutes,
  objective: `完成「${title}」的練習`,
  method: "示範後分組實作",
  outcome: `一份「${title}」的成品`,
  keyPoints: ["重點一"],
  activity: "用自己的資料做一次" as string | null,
  elements: ["handsOn" as const],
  carriesFrom,
  source: { kind: "framework" as const, id: "fw-weekly-report", version: 1, unit: title } as Unit["source"],
  reuse: "reuse" as Unit["reuse"],
});

/** 兩天、每天上午下午各一個 180 分鐘時段，每個時段的單元分鐘數都剛好加滿。 */
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
          { label: "上午", minutes: 180, units: [unit("週報拆解", 60), unit("第一份草稿", 120)] },
          { label: "下午", minutes: 180, units: [unit("檢查與修正", 90), unit("做成範本", 90)] },
        ],
      },
      {
        theme: "把範本推給整個部門",
        slots: [
          { label: "上午", minutes: 180, units: [unit("部門版範本", 180, "做成範本")] },
          { label: "下午", minutes: 180, units: [unit("上線與維護", 180)] },
        ],
      },
    ],
    constraints: ["教室只有投影機，沒有網路白名單問題"],
    tools: [{ name: "ChatGPT", plan: "free", confirmedWithClient: true }],
    openQuestions: [],
    ...overrides,
  });
}

describe("BlueprintSchema", () => {
  it("接受天 → 時段 → 單元的完整藍圖", () => {
    expect(() => sampleBlueprint()).not.toThrow();
  });

  it("拒絕沒有學習成果的藍圖", () => {
    expect(() => sampleBlueprint({ outcomes: [] })).toThrow();
  });

  it("拒絕沒有任何一天的藍圖", () => {
    expect(() => sampleBlueprint({ days: [] })).toThrow();
  });

  it("單元記錄來源與沿用程度；新做的單元來源為 null", () => {
    const bp = sampleBlueprint();
    bp.days[0].slots[0].units[0] = { ...bp.days[0].slots[0].units[0], source: null, reuse: "new" };
    bp.days[0].slots[0].units[1] = {
      ...bp.days[0].slots[0].units[1],
      source: { kind: "course", id: "c-weekly-staff", version: 3, unit: "第一份草稿" },
      reuse: "modify",
    };
    expect(() => BlueprintSchema.parse(bp)).not.toThrow();
  });

  it("拒絕不認得的沿用程度與來源種類", () => {
    const bp = sampleBlueprint();
    const u = bp.days[0].slots[0].units[0];
    expect(() => BlueprintSchema.parse({ ...bp, days: [{ ...bp.days[0], slots: [{ ...bp.days[0].slots[0], units: [{ ...u, reuse: "copy" }] }] }] })).toThrow();
    expect(() =>
      BlueprintSchema.parse({ ...bp, days: [{ ...bp.days[0], slots: [{ ...bp.days[0].slots[0], units: [{ ...u, source: { ...u.source, kind: "scenario" } }] }] }] }),
    ).toThrow();
  });

  it("仍可轉成 Claude 結構化輸出的格式", () => {
    expect(() => zodOutputFormat(BlueprintSchema)).not.toThrow();
  });
});

describe("totalMinutes", () => {
  it("總時長由各天各時段的長度加總而來", () => {
    expect(totalMinutes(sampleBlueprint())).toBe(720);
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

  it("時段的單元分鐘數加總不等於時段長度時，指出是第幾天第幾個時段", () => {
    const bp = sampleBlueprint();
    bp.days[1].slots[0].units[0].minutes = 150;
    expect(checkBlueprint(bp)).toEqual([
      { kind: "duration_mismatch", day: 2, slot: 1, planned: 150, expected: 180 },
    ]);
  });

  it("時段長度不是 180 也行，只要單元加總對得上就不提示", () => {
    const bp = sampleBlueprint();
    bp.days[0].slots[1].minutes = 120;
    bp.days[0].slots[1].units = [unit("檢查與修正", 60), unit("做成範本", 60)];
    expect(checkBlueprint(bp)).toEqual([]);
    expect(totalMinutes(bp)).toBe(660);
  });

  it("沒有動手環節的單元標成純講述單元", () => {
    const bp = sampleBlueprint();
    bp.days[0].slots[1].units[0].activity = null;
    expect(checkBlueprint(bp)).toEqual([
      { kind: "lecture_only", day: 1, slot: 2, unit: "檢查與修正" },
    ]);
  });

  it("有動手環節的單元不算純講述", () => {
    const bp = sampleBlueprint();
    bp.days[0].slots[1].units[0].activity = "兩人一組互相挑錯";
    expect(checkBlueprint(bp).map((i) => i.kind)).not.toContain("lecture_only");
  });

  it("要改的單元列出位置與沿用程度", () => {
    const bp = sampleBlueprint();
    bp.days[1].slots[0].units[0].reuse = "modify";
    expect(checkBlueprint(bp)).toEqual([
      { kind: "unit_needs_work", day: 2, slot: 1, unit: "部門版範本", reuse: "modify" },
    ]);
  });

  it("新做的單元也列出", () => {
    const bp = sampleBlueprint();
    bp.days[0].slots[1].units[1] = { ...bp.days[0].slots[1].units[1], source: null, reuse: "new" };
    expect(checkBlueprint(bp)).toEqual([
      { kind: "unit_needs_work", day: 1, slot: 2, unit: "做成範本", reuse: "new" },
    ]);
  });

  it("沿用的單元不列出", () => {
    expect(checkBlueprint(sampleBlueprint()).map((i) => i.kind)).not.toContain("unit_needs_work");
  });

  it("待確認事項逐條列出，帶著對象與受影響單元", () => {
    const bp = sampleBlueprint({
      openQuestions: [
        { text: "場地有沒有 Wi-Fi", audience: "client", unit: "第一份草稿" },
        { text: "範本要不要附評分表", audience: "self", unit: null },
      ],
    });
    expect(checkBlueprint(bp)).toEqual([
      { kind: "open_question", text: "場地有沒有 Wi-Fi", audience: "client", unit: "第一份草稿" },
      { kind: "open_question", text: "範本要不要附評分表", audience: "self", unit: null },
    ]);
  });

  it("拒絕對象不是問客戶或自己決定的待確認事項", () => {
    expect(() =>
      sampleBlueprint({ openQuestions: [{ text: "場地", audience: "boss" as "client", unit: null }] }),
    ).toThrow();
  });

  it("還沒跟客戶確認的工具列為問客戶的待確認事項", () => {
    const bp = sampleBlueprint({
      tools: [
        { name: "ChatGPT", plan: "free", confirmedWithClient: true },
        { name: "Copilot", plan: "enterprise", confirmedWithClient: false },
      ],
    });
    expect(checkBlueprint(bp)).toEqual([{ kind: "unconfirmed_tool", tool: "Copilot", plan: "enterprise" }]);
  });

  it("已確認的工具不提示", () => {
    const bp = sampleBlueprint({
      tools: [{ name: "Copilot", plan: "paid", confirmedWithClient: true }],
    });
    expect(checkBlueprint(bp)).toEqual([]);
  });

  it("拒絕方案等級不是 free／paid／enterprise 的工具", () => {
    expect(() =>
      sampleBlueprint({ tools: [{ name: "Copilot", plan: "pro" as "paid", confirmedWithClient: false }] }),
    ).toThrow();
  });
});
