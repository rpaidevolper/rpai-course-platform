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

export const ModuleSchema = z.object({
  title: NonEmpty,
  minutes: z.number().int().positive(),
  objective: NonEmpty.describe("學員上完這段能做到什麼，動詞開頭"),
  keyPoints: z.array(NonEmpty).min(1),
  activity: z.string().nullable().describe("動手環節的做法；純講述則為 null"),
  elements: z
    .array(z.enum(FIVE_ELEMENTS))
    .describe("這一段覆蓋了五元素中的哪幾個"),
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
    durationMinutes: z.number().int().positive(),
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
  modules: z.array(ModuleSchema).min(1),
  constraints: z.array(NonEmpty).describe("場地、設備、時間、政策等限制"),
  openQuestions: z.array(NonEmpty).describe("還沒跟講師確認的事"),
});

export type Blueprint = z.infer<typeof BlueprintSchema>;

/** 五元素裡還是空的那幾格。 */
export function missingElements(bp: Blueprint): FiveElement[] {
  return FIVE_ELEMENTS.filter((e) => bp.elements[e].length === 0);
}

/** 各單元分鐘數加總。 */
export function plannedMinutes(bp: Blueprint): number {
  return bp.modules.reduce((sum, m) => sum + m.minutes, 0);
}

export type BlueprintIssue =
  | { kind: "missing_element"; element: FiveElement }
  | { kind: "duration_mismatch"; planned: number; expected: number }
  | { kind: "open_question"; question: string };

/**
 * 藍圖完整性檢查。回傳空陣列代表可以放心拿去生成教材；
 * 有問題不代表不能生成，而是 UI 要把它們秀給講師看。
 */
export function checkBlueprint(bp: Blueprint): BlueprintIssue[] {
  const issues: BlueprintIssue[] = [];

  for (const element of missingElements(bp)) {
    issues.push({ kind: "missing_element", element });
  }

  const planned = plannedMinutes(bp);
  if (planned !== bp.format.durationMinutes) {
    issues.push({
      kind: "duration_mismatch",
      planned,
      expected: bp.format.durationMinutes,
    });
  }

  for (const question of bp.openQuestions) {
    issues.push({ kind: "open_question", question });
  }

  return issues;
}
