import {
  checkBlueprint,
  TOOL_PLAN_LABELS,
  type Blueprint,
  type OpenQuestionAudience,
  type SlotLocation,
} from "./schema";

/**
 * 一筆待確認事項，不論來自 openQuestions 還是未確認的工具。
 * `unit` 是受影響單元的標題（與 carriesFrom 同一種參照方式）；`tool` 標出它來自哪個未確認工具。
 */
export interface OpenItem {
  text: string;
  audience: OpenQuestionAudience;
  unit: string | null;
  tool: string | null;
}

/**
 * 藍圖所有待確認事項：openQuestions 依序在前，未確認的工具視為問客戶的事項接在後面。
 * 由 checkBlueprint 的結果推得，確保畫面、準備度與信件文字看到的是同一份清單。
 */
export function openItems(bp: Blueprint): OpenItem[] {
  const items: OpenItem[] = [];
  for (const issue of checkBlueprint(bp)) {
    if (issue.kind === "open_question") {
      items.push({ text: issue.text, audience: issue.audience, unit: issue.unit, tool: null });
    } else if (issue.kind === "unconfirmed_tool") {
      items.push({
        text: `學員是否都能使用 ${issue.tool}（${TOOL_PLAN_LABELS[issue.plan]}）？`,
        audience: "client",
        unit: null,
        tool: issue.tool,
      });
    }
  }
  return items;
}

/** 依標題找單元在第幾天、哪個時段；找不到回傳 null。 */
export function findUnit(bp: Blueprint, title: string): (SlotLocation & { slotLabel: string }) | null {
  for (const [di, day] of bp.days.entries()) {
    for (const [si, slot] of day.slots.entries()) {
      if (slot.units.some((u) => u.title === title)) {
        return { day: di + 1, slot: si + 1, slotLabel: slot.label };
      }
    }
  }
  return null;
}

/** 受影響單元的人話位置，例如「第 2 天上午「部門版範本」」。 */
export function unitPlace(bp: Blueprint, title: string): string {
  const at = findUnit(bp, title);
  return at ? `第 ${at.day} 天${at.slotLabel}「${title}」` : `「${title}」`;
}

/**
 * 把所有問客戶的事項排成一段可以直接貼進信件的文字。平台不代寄。
 * 沒有要問客戶的事時回傳 null，畫面據此隱藏「複製」。
 */
export function clientEmailText(bp: Blueprint): string | null {
  const items = openItems(bp).filter((i) => i.audience === "client");
  if (items.length === 0) return null;
  const lines = items.map((item, i) => {
    const affects = item.unit ? `（影響${unitPlace(bp, item.unit)}）` : "";
    return `${i + 1}. ${item.text}${affects}`;
  });
  return [`關於「${bp.title}」，有幾件事想跟您確認：`, "", ...lines].join("\n");
}
