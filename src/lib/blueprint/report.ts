import {
  checkBlueprint,
  FIVE_ELEMENT_LABELS,
  missingElements,
  REUSE_LABELS,
  totalMinutes,
  type Blueprint,
  type BlueprintIssue,
} from "./schema";
import { openItems, type OpenItem } from "./open-items";

/** 藍圖的完整性報告，給講師與 AI 看。 */
export interface BlueprintReport {
  total_minutes: number;
  /** 缺的五元素的中文名稱，依 FIVE_ELEMENTS 順序，例如 ["金句", "故事"] */
  missing_elements: string[];
  /** 給講師看的中文句子 */
  issues: string[];
  /** openItems(bp) 原樣 */
  open_items: OpenItem[];
}

/**
 * 把 checkBlueprint 的結果排成人話。待確認事項不放進 issues，它們已經在 open_items 裡。
 */
export function blueprintReport(bp: Blueprint): BlueprintReport {
  const issues: string[] = [];
  for (const issue of checkBlueprint(bp)) {
    const sentence = issueSentence(bp, issue);
    if (sentence !== null) issues.push(sentence);
  }
  return {
    total_minutes: totalMinutes(bp),
    missing_elements: missingElements(bp).map((element) => FIVE_ELEMENT_LABELS[element]),
    issues,
    open_items: openItems(bp),
  };
}

/** 一筆問題的人話句子；待確認事項已在 open_items 裡，回 null。 */
function issueSentence(bp: Blueprint, issue: BlueprintIssue): string | null {
  switch (issue.kind) {
    case "missing_element":
      return `五元素缺「${FIVE_ELEMENT_LABELS[issue.element]}」。`;
    case "duration_mismatch":
      return `第 ${issue.day} 天${slotLabel(bp, issue.day, issue.slot)}：單元加起來 ${issue.planned} 分鐘，但時段是 ${issue.expected} 分鐘。`;
    case "lecture_only":
      return `第 ${issue.day} 天${slotLabel(bp, issue.day, issue.slot)}「${issue.unit}」是純講述單元，沒有動手環節。`;
    case "unit_needs_work":
      return `第 ${issue.day} 天${slotLabel(bp, issue.day, issue.slot)}「${issue.unit}」${REUSE_LABELS[issue.reuse]}，還要準備。`;
    case "unit_unrated":
      return `第 ${issue.day} 天${slotLabel(bp, issue.day, issue.slot)}「${issue.unit}」的應用層級還沒評。`;
    case "open_question":
    case "unconfirmed_tool":
      return null;
    default: {
      const unhandled: never = issue;
      throw new Error(`未處理的藍圖問題：${JSON.stringify(unhandled)}`);
    }
  }
}

/** 第 day 天第 slot 個時段的名稱，例如「上午」。 */
function slotLabel(bp: Blueprint, day: number, slot: number): string {
  return bp.days[day - 1].slots[slot - 1].label;
}
