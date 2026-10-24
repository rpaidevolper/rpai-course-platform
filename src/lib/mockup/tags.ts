import { totalMinutes } from "@/lib/blueprint/schema";
import { industriesOfUnit, recipeMinutes } from "./logic";
import type { DemoState } from "./state";
import type { Course, CourseRecipe, IndustryPack, TagSet, UnitCard } from "./types";

/**
 * 標籤（GLOSSARY）：對象、工具、產業、應用場景四組可多選，存在單元卡、課程配方、產業素材包與課程上；
 * 第五組「規格」不存，由總時數推得。
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

/** 課程配方的規格：由單元卡分鐘數加總推得。 */
export const recipeSpec = (st: DemoState, recipe: CourseRecipe): Spec | null => specOfMinutes(recipeMinutes(st, recipe));

/** 課程的規格：由藍圖總分鐘數（totalMinutes）推得；藍圖改了規格跟著變。 */
export const courseSpec = (course: Course): Spec | null => specOfMinutes(totalMinutes(course.blueprint));

/** 多選：有就拿掉、沒有就加到最後；不改動傳入的陣列。 */
export function toggleTag<T extends string>(selected: readonly T[], value: T): T[] {
  return selected.includes(value) ? selected.filter((x) => x !== value) : [...selected, value];
}

/** 去掉重複、保留第一次出現的順序。 */
export const uniqueTags = <T extends string>(values: readonly T[]): T[] => [...new Set(values)];

export const emptyTags = (): TagSet => ({ audiences: [], tools: [], industries: [], scenarios: [] });

/** 開課程時標籤的預設值：帶入所選產業素材包的標籤；沒有素材包就是空的。講師之後可以改。 */
export function defaultCourseTags(pack: IndustryPack | undefined): TagSet {
  if (!pack) return emptyTags();
  return { audiences: [...pack.audiences], tools: [...pack.tools], industries: [...pack.industries], scenarios: [...pack.scenarios] };
}

/** 單元卡的完整標籤：對象、工具、應用場景存在卡上；產業由用過它的課程配方推得（不另存）。 */
export function unitTags(st: DemoState, unit: UnitCard): TagSet {
  return { audiences: unit.audiences, tools: unit.tools, industries: industriesOfUnit(st, unit.id), scenarios: unit.scenarios };
}

/** 標籤的顯示順序與名稱（對象、工具、產業、應用場景）。 */
export const TAG_GROUPS: { key: keyof TagSet; label: string }[] = [
  { key: "audiences", label: "對象" },
  { key: "tools", label: "工具" },
  { key: "industries", label: "產業" },
  { key: "scenarios", label: "應用場景" },
];
