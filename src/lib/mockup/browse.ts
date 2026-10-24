import { latestBlueprintVersion, moduleLabel, recipeModules, recipeUnitCards } from "./logic";
import type { DemoState } from "./state";
import { recipeSpec, unitTags, type Spec } from "./tags";
import { RECIPE_STATUS_LABELS, type Course, type CourseRecipe, type ModuleId, type TagSet, type UnitCard } from "./types";

/**
 * 知識庫瀏覽（#61）：篩選、搜尋單元卡與課程配方，以及「平台上哪些課程用過它」。
 * 全是純函式，資料從呼叫端傳入的 DemoState 讀；篩選條件是畫面狀態，不存進 DemoState。
 */

export interface KnowledgeFilter {
  /** 模組；空陣列＝不限 */
  moduleIds: ModuleId[];
  /** 對象、工具、產業、應用場景；空陣列＝該組不限 */
  tags: TagSet;
  /** 規格：只套用在課程配方（單元卡沒有規格，不受影響）；空陣列＝不限 */
  specs: Spec[];
  /** 關鍵字；空白＝不搜尋 */
  keyword: string;
}

export const noFilter = (): KnowledgeFilter => ({
  moduleIds: [],
  tags: { audiences: [], tools: [], industries: [], scenarios: [] },
  specs: [],
  keyword: "",
});

/** 有沒有設任何條件（畫面用來決定顯示「清除條件」）。 */
export const hasFilter = (f: KnowledgeFilter) =>
  f.moduleIds.length > 0 || f.specs.length > 0 || normalizeKeyword(f.keyword).length > 0 || Object.values(f.tags).some((v) => v.length > 0);

/**
 * 篩選語意：
 * - 不同條件之間是 AND（模組、四組標籤、規格、關鍵字都要符合）。
 * - 同一組內多選是 OR（選了 Claude 與 NotebookLM，用到其中一個就算）。
 * - 沒選的組不設限。
 */
const matchesGroup = (selected: readonly string[], actual: readonly string[]) =>
  selected.length === 0 || selected.some((s) => actual.includes(s));

const matchesTags = (selected: TagSet, actual: TagSet) =>
  matchesGroup(selected.audiences, actual.audiences) &&
  matchesGroup(selected.tools, actual.tools) &&
  matchesGroup(selected.industries, actual.industries) &&
  matchesGroup(selected.scenarios, actual.scenarios);

/**
 * 關鍵字正規化：NFKC（全形轉半形）、轉小寫、去頭尾空白，再依空白切成詞。
 * 每個詞都要出現（AND）在被搜尋的文字裡，不必相鄰、順序不拘；詞本身是子字串比對。
 */
function normalizeKeyword(keyword: string): string[] {
  return keyword.normalize("NFKC").toLowerCase().split(/\s+/).filter(Boolean);
}

/** 搜尋用的文字：欄位以換行相隔，所以沒有空白的詞不會跨欄位湊出來。 */
const haystack = (fields: readonly string[]) => fields.join("\n").normalize("NFKC").toLowerCase();

const matchesKeyword = (keyword: string, fields: readonly string[]) => {
  const terms = normalizeKeyword(keyword);
  if (terms.length === 0) return true;
  const text = haystack(fields);
  return terms.every((t) => text.includes(t));
};

const tagValues = (t: TagSet) => [...t.audiences, ...t.tools, ...t.industries, ...t.scenarios];

/**
 * 篩選單元卡。關鍵字比對：標題、目標、教學方式、成果、模組名稱，以及對象／工具／產業／應用場景標籤
 * （產業由用過它的課程配方推得）。規格不適用單元卡，略過。
 */
export function filterUnitCards(st: DemoState, f: KnowledgeFilter): UnitCard[] {
  return st.unitCards.filter((u) => {
    if (f.moduleIds.length > 0 && !f.moduleIds.includes(u.moduleId)) return false;
    const tags = unitTags(st, u);
    if (!matchesTags(f.tags, tags)) return false;
    return matchesKeyword(f.keyword, [u.title, u.objective, u.method, u.outcome, moduleLabel(u.moduleId), ...tagValues(tags)]);
  });
}

/**
 * 篩選課程配方。模組：至少用到所選模組一張單元卡。規格：由單元分鐘數推得，算不出規格的不符合。
 * 關鍵字比對：標題、客戶、狀態、用到的模組名稱、單元標題與四組標籤。
 */
export function filterRecipes(st: DemoState, f: KnowledgeFilter): CourseRecipe[] {
  return st.recipes.filter((r) => {
    if (f.moduleIds.length > 0 && !recipeModules(st, r).some((m) => f.moduleIds.includes(m))) return false;
    if (!matchesTags(f.tags, r)) return false;
    if (f.specs.length > 0) {
      const spec = recipeSpec(st, r);
      if (!spec || !f.specs.includes(spec)) return false;
    }
    return matchesKeyword(f.keyword, [
      r.title,
      RECIPE_STATUS_LABELS[r.status],
      ...recipeModules(st, r).map(moduleLabel),
      ...recipeUnitCards(st, r).map((u) => u.title),
      ...tagValues(r),
    ]);
  });
}

// ── 用過的課程 ────────────────────────────────────────

/** 一門用過的課程：最新一版藍圖的版本，以及是藍圖裡哪幾個單元（標題）用到。 */
export interface CourseUsage {
  course: Course;
  blueprintVersion: number;
  unitTitles: string[];
}

/**
 * 「用過」一律從課程**最新一版藍圖**的單元推得，不另存；藍圖改了，結果跟著變。
 * 設計稿只留最新藍圖的內容（舊版只有版本紀錄），所以版本固定是最新版。
 */
function usageOf(st: DemoState, pick: (u: Course["blueprint"]["days"][number]["slots"][number]["units"][number]) => boolean): CourseUsage[] {
  const usages: CourseUsage[] = [];
  for (const course of st.courses) {
    const unitTitles = course.blueprint.days.flatMap((d) => d.slots.flatMap((s) => s.units.filter(pick).map((u) => u.title)));
    if (unitTitles.length > 0) usages.push({ course, blueprintVersion: latestBlueprintVersion(course), unitTitles });
  }
  return usages;
}

/** 用過某張單元卡的課程：藍圖單元的 source 是 { kind: "unit_card", id }。來源是另一門課程的單元不算。 */
export const unitCardUsage = (st: DemoState, unitCardId: string): CourseUsage[] =>
  usageOf(st, (u) => u.source?.kind === "unit_card" && u.source.id === unitCardId);

/**
 * 用過某張模組卡的課程：藍圖裡有單元屬於該模組（unit.module）。
 * 不用 Course.source.moduleIds（那只記錄開課時挑了什麼，藍圖之後可能換掉模組）。
 */
export const moduleCardUsage = (st: DemoState, moduleId: ModuleId): CourseUsage[] => usageOf(st, (u) => u.module === moduleId);
