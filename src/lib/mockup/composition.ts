import { getModule, type ModuleId } from "@/lib/blueprint/modules";

/** 組課提醒：只提醒、不擋建立課程。 */
export type CompositionWarning =
  /** 沒有選 B 模組（方法）定錨 */
  | { kind: "no_b" }
  /** 總時數不到一天卻選了太多 A（環境）模組 */
  | { kind: "too_many_a"; aCount: number; totalHours: number };

/** 總時數在這個時數以下（含）時，A 模組不宜超過 MAX_A_IN_SHORT_COURSE 個 */
export const SHORT_COURSE_MAX_HOURS = 6;
export const MAX_A_IN_SHORT_COURSE = 2;

/**
 * 組課提醒（純函式）。輸入所選模組與總時數（小時），回傳提醒清單；空清單代表沒有提醒。
 * - 沒有 B：回 no_b。
 * - 總時數 ≤ 6H 且 A 超過 2 個：回 too_many_a（2 個不提醒、3 個要）。
 * 重複的模組只算一次。
 */
export function compositionWarnings({ moduleIds, totalHours }: { moduleIds: ModuleId[]; totalHours: number }): CompositionWarning[] {
  const chosen = new Set(moduleIds);
  const kindOf = (id: ModuleId) => getModule(id).kind;
  const aCount = [...chosen].filter((id) => kindOf(id) === "A").length;
  const bCount = chosen.size - aCount;

  const warnings: CompositionWarning[] = [];
  if (bCount === 0) warnings.push({ kind: "no_b" });
  if (totalHours <= SHORT_COURSE_MAX_HOURS && aCount > MAX_A_IN_SHORT_COURSE) warnings.push({ kind: "too_many_a", aCount, totalHours });
  return warnings;
}

/** 提醒的顯示文字 */
export function compositionWarningText(w: CompositionWarning): string {
  switch (w.kind) {
    case "no_b":
      return "還沒選 B 模組：建議挑 1 個方法模組當課程的定錨，不然課會變成只在示範工具。";
    case "too_many_a":
      return `總時數 ${w.totalHours} 小時卻選了 ${w.aCount} 個 A 模組：${SHORT_COURSE_MAX_HOURS} 小時以下建議最多 ${MAX_A_IN_SHORT_COURSE} 個，學員光裝環境就用完時間。`;
  }
}
