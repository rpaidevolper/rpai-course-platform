import { describe, expect, it } from "vitest";
import { mapRequirements, type MappableRequirement } from "./requirement-mapping";
import { BlueprintSchema, type Blueprint } from "./schema";

const unit = (title: string, minutes: number, extra: { keyPoints?: string[]; activity?: string | null } = {}) => ({
  title,
  minutes,
  objective: `完成「${title}」`,
  method: "示範後個人實作",
  outcome: `一份「${title}」成品`,
  keyPoints: extra.keyPoints ?? ["重點"],
  activity: extra.activity === undefined ? "動手做一次" : extra.activity,
  elements: ["handsOn" as const],
  carriesFrom: null,
  source: null,
  reuse: "new" as const,
});

/** 兩天；痛點提到「週會」，但沒有任何單元提到它。 */
function blueprint(): Blueprint {
  return BlueprintSchema.parse({
    title: "測試藍圖",
    oneLiner: "測試用",
    audience: { who: "內勤", size: null, priorKnowledge: "會 Excel", painPoints: ["週會決議沒人追"] },
    outcomes: ["做出 8D 草稿"],
    format: { mode: "workshop", venue: null },
    narrative: { model: "SCQA", arc: ["情境", "解答"] },
    elements: { theory: ["a"], handsOn: ["b"], takeaway: ["c"], quote: ["d"], story: ["e"] },
    days: [
      {
        theme: "客訴信",
        slots: [
          {
            label: "上午",
            minutes: 180,
            units: [unit("AI 能做什麼", 60), unit("8D 報告草稿", 120, { keyPoints: ["8D 格式寫死"] })],
          },
        ],
      },
      {
        theme: "部門流程",
        slots: [
          {
            label: "下午",
            minutes: 180,
            units: [
              unit("用 Project 記住脈絡", 120, { activity: "建立 Project 並回覆一封供應商來信" }),
              unit("三件事清單", 60, { activity: null }),
            ],
          },
        ],
      },
    ],
    tools: [],
    constraints: [],
    openQuestions: [],
  });
}

const req = (id: string, keywords: string[], minutes: number | null): MappableRequirement => ({
  id,
  text: `需求 ${id}`,
  keywords,
  minutes,
});

describe("mapRequirements 需求對照", () => {
  it("❌ 單元裡字面上找不到關鍵詞：not_found，藍圖安排 0 分", () => {
    const [m] = mapRequirements(blueprint(), [req("weekly", ["週會"], 30)]);
    expect(m).toMatchObject({ requirementId: "weekly", status: "not_found", units: [], allocatedMinutes: 0, deltaMinutes: -30 });
  });

  it("✅ 關鍵詞出現在單元、時數足夠：covered，時數變化為藍圖減要求", () => {
    const [m] = mapRequirements(blueprint(), [req("8d", ["8D", "報告"], 90)]);
    expect(m.status).toBe("covered");
    expect(m.reasons).toEqual([]);
    expect(m.units).toEqual([
      { day: 1, slot: 1, unit: 2, title: "8D 報告草稿", minutes: 120, sharedMinutes: 120, sharedWith: [] },
    ]);
    expect(m).toMatchObject({ requestedMinutes: 90, allocatedMinutes: 120, deltaMinutes: 30 });
  });

  it("⚠️ 時數偏短：命中但藍圖安排少於客戶要求", () => {
    const [m] = mapRequirements(blueprint(), [req("limits", ["能做什麼"], 90)]);
    expect(m).toMatchObject({ status: "partial", reasons: ["short"], allocatedMinutes: 60, deltaMinutes: -30 });
  });

  it("⚠️ 擠在一起：兩條需求命中同一單元，分鐘數平均分攤", () => {
    const [project, supplier] = mapRequirements(blueprint(), [
      req("project", ["Project"], null),
      req("supplier", ["供應商"], 90),
    ]);
    expect(project).toMatchObject({ status: "partial", reasons: ["crammed"], allocatedMinutes: 60, deltaMinutes: null });
    expect(project.units[0].sharedWith).toEqual(["supplier"]);
    expect(supplier).toMatchObject({ status: "partial", reasons: ["crammed", "short"], allocatedMinutes: 60, deltaMinutes: -30 });
  });

  it("命中多個單元時，時數加總", () => {
    const [m] = mapRequirements(blueprint(), [req("all", ["完成"], 400)]);
    expect(m.units).toHaveLength(4);
    expect(m).toMatchObject({ status: "partial", reasons: ["short"], allocatedMinutes: 360, deltaMinutes: -40 });
  });

  it("關鍵詞必須全部出現在同一個單元", () => {
    const [m] = mapRequirements(blueprint(), [req("mixed", ["8D", "供應商"], null)]);
    expect(m.status).toBe("not_found");
  });

  it("只比對單元：只出現在受眾痛點或天的主軸的字不算", () => {
    const [weekly, theme] = mapRequirements(blueprint(), [req("weekly", ["週會"], null), req("theme", ["部門流程"], null)]);
    expect(weekly.status).toBe("not_found");
    expect(theme.status).toBe("not_found");
  });

  it("比對忽略全形半形、大小寫與空白", () => {
    const [m] = mapRequirements(blueprint(), [req("fw", ["８ｄ報 告", "PROJECT"], null)]);
    expect(m.status).toBe("not_found");
    const [d] = mapRequirements(blueprint(), [req("fw", ["８ｄ報 告"], null)]);
    expect(d.status).toBe("covered");
  });

  it("沒有關鍵詞時以整句原文比對", () => {
    const [m] = mapRequirements(blueprint(), [{ id: "t", text: "三件事 清單", keywords: [], minutes: 60 }]);
    expect(m).toMatchObject({ status: "covered", allocatedMinutes: 60, deltaMinutes: 0 });
  });

  it("客戶沒指定時數：不檢查偏短，時數變化為 null", () => {
    const [m] = mapRequirements(blueprint(), [req("8d", ["8D"], null)]);
    expect(m).toMatchObject({ status: "covered", requestedMinutes: null, allocatedMinutes: 120, deltaMinutes: null });
  });
});
