import { z } from "zod";

/**
 * 教學藍圖：一場課的唯一真相來源。
 * 課程大綱、簡報、學員手冊都從這份資料生成，所以欄位以「生成時需要知道什麼」為準。
 *
 * 這份 schema 同時餵給 Claude 的結構化輸出（zodOutputFormat），
 * 所以不用 optional / default，可缺的欄位一律 nullable，陣列可為空。
 */

/** 五元素：每場課都應該同時具備，缺一則藍圖不完整。 */
export const FIVE_ELEMENTS = [
  "theory",
  "handsOn",
  "takeaway",
  "quote",
  "story",
] as const;
export type FiveElement = (typeof FIVE_ELEMENTS)[number];

export const FIVE_ELEMENT_LABELS: Record<FiveElement, string> = {
  theory: "理論",
  handsOn: "動手",
  takeaway: "帶走",
  quote: "金句",
  story: "故事",
};

const NonEmpty = z.string().trim().min(1);

/** 時段預設長度：講師以「三小時一段、不另排休息」排課。 */
export const DEFAULT_SLOT_MINUTES = 180;

/** 單元：時段裡的一段教學。 */
export const UnitSchema = z.object({
  title: NonEmpty,
  minutes: z.number().int().positive(),
  objective: NonEmpty.describe("學習目標：學員上完這段能做到什麼，動詞開頭"),
  method: NonEmpty.describe("教學方式，例如講述＋示範、分組實作、互評"),
  outcome: NonEmpty.describe("成果：學員上完這段手上會多出什麼"),
  keyPoints: z.array(NonEmpty).min(1),
  activity: z
    .string()
    .nullable()
    .describe("動手環節的做法；沒有動手環節（純講述單元）則為 null"),
  elements: z
    .array(z.enum(FIVE_ELEMENTS))
    .describe("這一段覆蓋了五元素中的哪幾個"),
  carriesFrom: z
    .string()
    .nullable()
    .describe("承接自哪個較早單元的標題（前一單元的成果是這個單元的輸入）；沒有則為 null"),
});

/** 時段：一天裡連續上課、不另排休息的一段。 */
export const SlotSchema = z.object({
  label: NonEmpty.describe("時段名稱，例如上午、下午"),
  minutes: z
    .number()
    .int()
    .positive()
    .describe(`時段長度（分鐘），講師沒特別說就用 ${DEFAULT_SLOT_MINUTES}；不另排休息`),
  units: z.array(UnitSchema).min(1),
});

/** 天：藍圖裡的一天課；系列課的一堂也算一天。 */
export const DaySchema = z.object({
  theme: NonEmpty.describe("這一天的主軸"),
  slots: z.array(SlotSchema).min(1).describe("依序排列的時段，通常上午、下午各一個"),
});

/** 工具的方案等級：免費／付費／企業版。 */
export const TOOL_PLANS = ["free", "paid", "enterprise"] as const;
export type ToolPlan = (typeof TOOL_PLANS)[number];

export const TOOL_PLAN_LABELS: Record<ToolPlan, string> = {
  free: "免費版",
  paid: "付費版",
  enterprise: "企業版",
};

/** 工具：學員上課要用的軟體或服務。 */
export const ToolSchema = z.object({
  name: NonEmpty.describe("工具名稱，例如 Claude、Power Automate"),
  plan: z.enum(TOOL_PLANS).describe("學員需要的方案等級"),
  confirmedWithClient: z
    .boolean()
    .describe("是否已跟客戶確認學員有這個方案；還沒確認就是 false，不要另外寫進 openQuestions"),
});

/** 待確認事項的對象：問客戶，或講師自己決定。 */
export const OPEN_QUESTION_AUDIENCES = ["client", "self"] as const;
export type OpenQuestionAudience = (typeof OPEN_QUESTION_AUDIENCES)[number];

export const OPEN_QUESTION_AUDIENCE_LABELS: Record<OpenQuestionAudience, string> = {
  client: "問客戶",
  self: "自己決定",
};

/** 待確認事項：藍圖裡還沒決定的事。 */
export const OpenQuestionSchema = z.object({
  text: NonEmpty.describe("要確認的事，寫成一句可以直接問出口的話"),
  audience: z
    .enum(OPEN_QUESTION_AUDIENCES)
    .describe("client：要客戶回答；self：講師自己決定就好"),
  unit: z
    .string()
    .nullable()
    .describe("受影響單元的標題，要和 days 裡某個單元的 title 完全一致；不限於某個單元則為 null"),
});

export const BlueprintSchema = z.object({
  title: NonEmpty,
  oneLiner: NonEmpty.describe("一句話說這場課在做什麼，非目標受眾也聽得懂"),
  audience: z.object({
    who: NonEmpty.describe("受眾是誰：職務、產業、情境"),
    size: z.number().int().positive().nullable(),
    priorKnowledge: NonEmpty.describe("受眾目前會什麼、不會什麼"),
    painPoints: z.array(NonEmpty).min(1),
  }),
  outcomes: z
    .array(NonEmpty)
    .min(1)
    .describe("學員離場時能做到的事，動詞開頭、可驗證"),
  format: z.object({
    mode: z.enum(["lecture", "workshop", "online", "hybrid"]),
    venue: z.string().nullable(),
  }),
  narrative: z.object({
    model: NonEmpty.describe("敘事模型，例如 SCQA、AIDA、PDCA"),
    arc: z.array(NonEmpty).min(2).describe("依序排列的敘事段落"),
  }),
  elements: z.object({
    theory: z.array(NonEmpty),
    handsOn: z.array(NonEmpty),
    takeaway: z.array(NonEmpty),
    quote: z.array(NonEmpty),
    story: z.array(NonEmpty),
  }),
  days: z
    .array(DaySchema)
    .min(1)
    .describe("依序排列的天；總時長由各時段長度加總，不另外填"),
  constraints: z.array(NonEmpty).describe("場地、設備、時間、政策等限制"),
  tools: z.array(ToolSchema).describe("學員上課要用的工具與方案等級"),
  openQuestions: z
    .array(OpenQuestionSchema)
    .describe("待確認事項；未確認的工具已由 tools 表達，不要重複列"),
});

export type Blueprint = z.infer<typeof BlueprintSchema>;
export type Day = z.infer<typeof DaySchema>;
export type Slot = z.infer<typeof SlotSchema>;
export type Unit = z.infer<typeof UnitSchema>;
export type Tool = z.infer<typeof ToolSchema>;
export type OpenQuestion = z.infer<typeof OpenQuestionSchema>;

/** 五元素裡還是空的那幾格。 */
export function missingElements(bp: Blueprint): FiveElement[] {
  return FIVE_ELEMENTS.filter((e) => bp.elements[e].length === 0);
}

/** 總時長：各天各時段長度加總。藍圖不另存總時長。 */
export function totalMinutes(bp: Blueprint): number {
  return bp.days.reduce(
    (sum, d) => sum + d.slots.reduce((s, slot) => s + slot.minutes, 0),
    0,
  );
}

/** 一個時段裡各單元分鐘數加總。 */
export function plannedMinutes(slot: Slot): number {
  return slot.units.reduce((sum, u) => sum + u.minutes, 0);
}

/** 純講述單元：沒有動手環節。 */
export const isLectureOnly = (unit: Unit) => unit.activity === null;

/** 天與時段的位置，皆從 1 起算（第 1 天、第 1 個時段）。 */
export interface SlotLocation {
  day: number;
  slot: number;
}

export type BlueprintIssue =
  | { kind: "missing_element"; element: FiveElement }
  | ({ kind: "duration_mismatch"; planned: number; expected: number } & SlotLocation)
  | ({ kind: "lecture_only"; unit: string } & SlotLocation)
  | ({ kind: "open_question" } & OpenQuestion)
  | { kind: "unconfirmed_tool"; tool: string; plan: ToolPlan };

/**
 * 藍圖完整性檢查。回傳空陣列代表可以放心拿去生成教材；
 * 有問題不代表不能生成，而是 UI 要把它們秀給講師看。
 */
export function checkBlueprint(bp: Blueprint): BlueprintIssue[] {
  const issues: BlueprintIssue[] = [];

  for (const element of missingElements(bp)) {
    issues.push({ kind: "missing_element", element });
  }

  bp.days.forEach((d, di) => {
    d.slots.forEach((slot, si) => {
      const at = { day: di + 1, slot: si + 1 };
      const planned = plannedMinutes(slot);
      if (planned !== slot.minutes) {
        issues.push({ kind: "duration_mismatch", ...at, planned, expected: slot.minutes });
      }
      for (const unit of slot.units) {
        if (isLectureOnly(unit)) issues.push({ kind: "lecture_only", ...at, unit: unit.title });
      }
    });
  });

  for (const q of bp.openQuestions) {
    issues.push({ kind: "open_question", ...q });
  }
  for (const tool of bp.tools) {
    if (!tool.confirmedWithClient) issues.push({ kind: "unconfirmed_tool", tool: tool.name, plan: tool.plan });
  }

  return issues;
}
