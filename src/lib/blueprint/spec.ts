/**
 * 規格（課程的時數級距）：由總時數推得。搬自 src/lib/mockup/tags.ts；知識庫的同步腳本也要用，
 * 而腳本是用 node --experimental-strip-types 直接跑的，所以這個檔案不能有任何 import。
 */

export type Spec = "短講座" | "半日" | "一日" | "兩日" | "系列班" | "長期班";

/** 規格由短到長的順序（篩選用）。 */
export const SPECS: readonly Spec[] = ["短講座", "半日", "一日", "兩日", "系列班", "長期班"];

/**
 * 規格由下界（分鐘）劃分，每一檔從自己的下界一路管到下一檔的下界之前：
 *   短講座 ≤2H・半日 3–4H・一日 6H・兩日 6H×2・系列班 6H×3–4・長期班 30H 以上。
 * 題目沒列出的時數（例如 2.5H、5H、8H、15H、25H）一律「沿用前一檔」（往下取整）：
 * 還沒到下一檔的門檻就不算那一檔，所以 5H 是半日（不是一日）、8H 是一日、15H 是兩日、25H 是系列班。
 * 0 以下沒有規格（null）。
 */
const SPEC_FLOORS: { floor: number; spec: Spec }[] = [
  { floor: 30 * 60, spec: "長期班" },
  { floor: 18 * 60, spec: "系列班" },
  { floor: 12 * 60, spec: "兩日" },
  { floor: 6 * 60, spec: "一日" },
  { floor: 3 * 60, spec: "半日" },
  { floor: 1, spec: "短講座" },
];

/** 總分鐘數 → 規格；沒有時數（≤0）回 null。 */
export function specOfMinutes(minutes: number): Spec | null {
  return SPEC_FLOORS.find((s) => minutes >= s.floor)?.spec ?? null;
}

/** 總小時數 → 規格；先四捨五入到分鐘，避免小數時數的浮點誤差把 18H 判成 17.999…H。 */
export function specOfHours(hours: number): Spec | null {
  return specOfMinutes(Math.round(hours * 60));
}
