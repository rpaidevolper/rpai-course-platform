import { totalMinutes } from "@/lib/blueprint/schema";
import { specOfMinutes, type Spec } from "@/lib/blueprint/spec";
import { industriesOfUnit, recipeMinutes } from "./logic";
import type { DemoState } from "./state";
import type { Course, CourseRecipe, CourseTagSet, IndustryPack, TagSet, UnitCard } from "./types";

/**
 * 標籤（GLOSSARY）：對象、工具、產業、應用場景四組可多選，存在單元卡、課程配方與產業素材包上，課程只存對象、產業、應用場景（工具由藍圖推得，見 courseTools）；
 * 第五組「規格」不存，由總時數推得。
 */

/** 規格的定義住在 @/lib/blueprint/spec（知識庫的同步腳本也要用，那邊不能有 @/ 的 import），這裡只轉出。 */
export { SPECS, specOfHours, specOfMinutes, type Spec } from "@/lib/blueprint/spec";

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

/**
 * 課程的工具標籤：由藍圖 tools 的名稱推得（原樣、依藍圖順序、去重），課程上不另存。
 * 藍圖的工具名稱是自由文字，標籤的「工具」一組也不限定詞彙（TOOL_TAGS 只是篩選的建議選項），所以直接沿用。
 * 顯示、篩選、結案回存都只從這裡取課程的工具。
 */
export const courseTools = (course: Course): string[] => uniqueTags(course.blueprint.tools.map((t) => t.name));

/** 課程的完整標籤（顯示用）：自己存的三組，加上由藍圖推得的工具。 */
export const courseTags = (course: Course): TagSet => ({
  audiences: course.audiences,
  tools: courseTools(course),
  industries: course.industries,
  scenarios: course.scenarios,
});

/** 開課程時標籤的預設值：帶入所選產業素材包的對象、產業、應用場景；沒有素材包就是空的。講師之後可以改。工具不帶（由藍圖談出）。 */
export function defaultCourseTags(pack: IndustryPack | undefined): CourseTagSet {
  if (!pack) return { audiences: [], industries: [], scenarios: [] };
  return { audiences: [...pack.audiences], industries: [...pack.industries], scenarios: [...pack.scenarios] };
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

/** 課程自己存、可以編輯的三組標籤（工具由藍圖推得，不在其中）。 */
export const COURSE_TAG_GROUPS = ["audiences", "industries", "scenarios"] as const satisfies readonly (keyof TagSet)[];
