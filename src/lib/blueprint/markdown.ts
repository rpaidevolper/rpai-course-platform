import { moduleLabel } from "./modules";
import { openItems, unitPlace } from "./open-items";
import {
  FIVE_ELEMENT_LABELS,
  FIVE_ELEMENTS,
  OPEN_QUESTION_AUDIENCE_LABELS,
  REUSE_LABELS,
  TOOL_PLAN_LABELS,
  totalMinutes,
  unitLevelText,
  type Blueprint,
  type Day,
  type Tool,
  type Unit,
  type UnitSource,
} from "./schema";

const MODE_LABELS: Record<Blueprint["format"]["mode"], string> = {
  lecture: "講座",
  workshop: "工作坊",
  online: "線上",
  hybrid: "混成",
};

/**
 * 藍圖的 Markdown 版本，給講師讀，也給不認得 JSON 的 AI 讀。每一格都寫出來：
 * 空的寫「（無）」，五元素缺的格寫「（缺）」。
 */
export function blueprintToMarkdown(bp: Blueprint): string {
  const blocks: string[][] = [
    [`# ${bp.title}`, "", bp.oneLiner],
    [
      "## 受眾",
      `- 對象：${bp.audience.who}`,
      `- 人數：${bp.audience.size === null ? "未定" : `${bp.audience.size} 人`}`,
      `- 先備：${bp.audience.priorKnowledge}`,
      `- 痛點：${bp.audience.painPoints.join("；")}`,
    ],
    ["## 學習成果", ...bulletsOrNone(bp.outcomes)],
    ["## 形式", `- ${MODE_LABELS[bp.format.mode]}・場地：${bp.format.venue ?? "未定"}`],
    ["## 敘事", `${bp.narrative.model}：${bp.narrative.arc.join(" → ")}`],
    ["## 五元素", ...FIVE_ELEMENTS.map((e) => `- ${FIVE_ELEMENT_LABELS[e]}：${elementText(bp.elements[e])}`)],
    [`## 課程安排（共 ${totalMinutes(bp)} 分鐘）`, ...bp.days.flatMap((day, i) => dayLines(day, i + 1))],
    ["## 限制", ...bulletsOrNone(bp.constraints)],
    ["## 工具", ...(bp.tools.length > 0 ? bp.tools.map(toolLine) : ["- （無）"])],
    ["## 待確認事項", ...openItemLines(bp)],
  ];
  return blocks.map((lines) => lines.join("\n")).join("\n\n") + "\n";
}

function bulletsOrNone(items: string[]): string[] {
  return items.length > 0 ? items.map((item) => `- ${item}`) : ["- （無）"];
}

/** 五元素的一格：多筆用「；」串起來，空的寫（缺）。 */
function elementText(items: string[]): string {
  return items.length > 0 ? items.join("；") : "（缺）";
}

function toolLine(tool: Tool): string {
  const confirmed = tool.confirmedWithClient ? "已確認" : "未跟客戶確認";
  return `- ${tool.name}（${TOOL_PLAN_LABELS[tool.plan]}）・${confirmed}`;
}

/** 待確認事項：openItems 的結果，沒有就寫（無）。 */
function openItemLines(bp: Blueprint): string[] {
  const items = openItems(bp);
  if (items.length === 0) return ["- （無）"];
  return items.map((item) => {
    const affects = item.unit === null ? "" : `（影響${unitPlace(bp, item.unit)}）`;
    return `- [${OPEN_QUESTION_AUDIENCE_LABELS[item.audience]}] ${item.text}${affects}`;
  });
}

/** 一天的段落，前後留空行。 */
function dayLines(day: Day, number: number): string[] {
  const lines = ["", `### 第 ${number} 天：${day.theme}`];
  for (const slot of day.slots) {
    lines.push("", `#### ${slot.label}（${slot.minutes} 分鐘）`, "");
    slot.units.forEach((unit, i) => lines.push(...unitLines(unit, i + 1)));
  }
  return lines;
}

/** 一個單元：編號清單，細項縮排到編號之後。 */
function unitLines(unit: Unit, n: number): string[] {
  const indent = " ".repeat(`${n}. `.length);
  const lines = [
    `${n}. **${unit.title}**（${unit.minutes} 分鐘・${moduleLabel(unit.module)}・${unitLevelText(unit.level)}・${REUSE_LABELS[unit.reuse]}）`,
    `${indent}- 學習目標：${unit.objective}`,
    `${indent}- 教學方式：${unit.method}`,
    `${indent}- 成果：${unit.outcome}`,
    `${indent}- 重點：${unit.keyPoints.join("；")}`,
    `${indent}- 動手環節：${unit.activity ?? "無（純講述）"}`,
    `${indent}- 五元素：${unit.elements.length > 0 ? unit.elements.map((e) => FIVE_ELEMENT_LABELS[e]).join("、") : "（無）"}`,
  ];
  if (unit.carriesFrom) lines.push(`${indent}- 承接：${unit.carriesFrom}`);
  lines.push(`${indent}- 來源：${sourceText(unit.source)}`);
  return lines;
}

function sourceText(source: UnitSource | null): string {
  if (source === null) return "新做";
  if (source.kind === "unit_card") return `單元卡 ${source.id}「${source.unit}」`;
  return source.version === null
    ? `課程 ${source.id}「${source.unit}」`
    : `課程 ${source.id} 第 ${source.version} 版「${source.unit}」`;
}
