import { getModuleCard, latestModuleCardVersion, moduleCardSkeleton } from "./logic";
import type { DemoState } from "./state";
import { uniqueTags } from "./tags";
import type { CourseRecipe, DraftProposal, IsoTime, KnowledgeDraft, ModuleCard, ModuleCardChange, UnitCard } from "./types";

/**
 * 知識庫草稿的審核（#60）：接受、捨棄、排除某個單元、改寫含客戶機密的文字。
 * 純函式，吃 DemoState 回傳新的 DemoState；不合規則的操作回傳原狀態。
 * 單元卡的內容只活在「新單元卡」草稿裡，課程配方只引用它的 id，所以排除與改寫都只動一處，
 * 配方、模組卡改動與單元卡草稿不會彼此對不上。
 */

/** 審核時可以改寫的文字：只含講師可能要拿掉客戶名稱的欄位，不能改 id 或單元的組成。 */
export type DraftRewrite =
  | { kind: "new_unit_card"; title?: string; objective?: string; method?: string; outcome?: string }
  | { kind: "new_course_recipe"; title?: string };

const without = (st: DemoState, id: string): DemoState => ({ ...st, drafts: st.drafts.filter((d) => d.id !== id) });

/**
 * 模組卡改動的說明文字，顯示與升版備註時才用「目前」的標題組出來：換上的單元卡可能還在待審的單元卡草稿裡，
 * 講師改寫它的標題後，說明跟著變。找不到的單元卡退回用 id，不會丟出錯。
 */
export function moduleChangeText(st: DemoState, change: ModuleCardChange): string {
  const pending = st.drafts.find((d) => d.proposal.kind === "new_unit_card" && d.proposal.unitCard.id === change.unitCardId)?.proposal;
  const next = st.unitCards.find((u) => u.id === change.unitCardId) ?? (pending?.kind === "new_unit_card" ? pending.unitCard : undefined);
  const old = st.unitCards.find((u) => u.id === change.replacesUnitCardId);
  return `骨架單元「${old?.title ?? change.replacesUnitCardId}」在這門課改成「${next?.title ?? change.unitCardId}」${next ? `（${next.minutes} 分）` : ""}`;
}

/** 非空白才算有改寫；去掉頭尾空白 */
const filled = (value: string | undefined, current: string): string => (value && value.trim() ? value.trim() : current);

/** 把某張單元卡從同一門課程（匯入則是 null）的待審草稿全部拿掉：配方裡的位置、單元卡草稿、更新草稿與模組卡改動。 */
function dropUnit(st: DemoState, fromCourseId: string | null, unitCardId: string): DemoState {
  const drafts = st.drafts.flatMap((d): KnowledgeDraft[] => {
    if (d.fromCourseId !== fromCourseId) return [d];
    const p = d.proposal;
    if (p.kind === "new_unit_card") return p.unitCard.id === unitCardId ? [] : [d];
    if (p.kind === "update_unit_card") return p.unitCardId === unitCardId ? [] : [d];
    if (p.kind === "new_course_recipe") return [{ ...d, proposal: { ...p, unitCardIds: p.unitCardIds.filter((id) => id !== unitCardId) } }];
    const changes = p.changes.filter((c) => c.unitCardId !== unitCardId);
    return changes.length === 0 ? [] : [{ ...d, proposal: { ...p, changes } }];
  });
  return { ...st, drafts };
}

/**
 * 能不能從課程配方草稿排除這個單元。已經在知識庫、又沒有待審更新草稿的單元（單獨收進的新單元卡，
 * 或已接受更新的卡）不能排除：排除只會把它從配方拿掉，留下沒有配方的孤兒單元卡。
 * 還沒收進的新單元卡，以及有待審更新草稿的既有單元卡，排除後相關草稿一併拿掉，知識庫維持一致。
 */
export function canExcludeUnit(st: DemoState, draftId: string, unitCardId: string): boolean {
  const draft = st.drafts.find((d) => d.id === draftId);
  if (!draft || draft.proposal.kind !== "new_course_recipe" || !draft.proposal.unitCardIds.includes(unitCardId)) return false;
  if (!st.unitCards.some((u) => u.id === unitCardId)) return true;
  return st.drafts.some((d) => d.fromCourseId === draft.fromCourseId && d.proposal.kind === "update_unit_card" && d.proposal.unitCardId === unitCardId);
}

/** 排除課程配方草稿裡的某個單元：配方、單元卡草稿、更新草稿與模組卡改動一起拿掉。 */
export function excludeUnit(st: DemoState, draftId: string, unitCardId: string): DemoState {
  const draft = st.drafts.find((d) => d.id === draftId);
  if (!draft || !canExcludeUnit(st, draftId, unitCardId)) return st;
  return dropUnit(st, draft.fromCourseId, unitCardId);
}

/**
 * 更新單元卡草稿要不要預告「用過的配方 +1」：只有同一門課程的課程配方草稿還待審、而且引用這張卡時才會。
 * 配方收進後 recipesUsingUnit 已經算進去，捨棄後則不會發生。
 */
export function pendingUsageIncrease(st: DemoState, update: KnowledgeDraft): boolean {
  const p = update.proposal;
  if (p.kind !== "update_unit_card") return false;
  return st.drafts.some((d) => d.fromCourseId === update.fromCourseId && d.proposal.kind === "new_course_recipe" && d.proposal.unitCardIds.includes(p.unitCardId));
}

/** 捨棄草稿。捨棄新單元卡等於排除那個單元（配方不能指向不會存在的單元卡）；其他種類只是不收。 */
export function discardDraft(st: DemoState, draftId: string): DemoState {
  const draft = st.drafts.find((d) => d.id === draftId);
  if (!draft) return st;
  const p = draft.proposal;
  return p.kind === "new_unit_card" ? dropUnit(st, draft.fromCourseId, p.unitCard.id) : without(st, draftId);
}

/** 改寫草稿裡的文字；種類對不上或空白的欄位忽略。模組卡新版本的說明由單元卡推得，不能直接改。 */
export function rewriteDraft(st: DemoState, draftId: string, patch: DraftRewrite): DemoState {
  const draft = st.drafts.find((d) => d.id === draftId);
  if (!draft || draft.proposal.kind !== patch.kind) return st;
  const p = draft.proposal;
  let next: DraftProposal = p;
  if (p.kind === "new_unit_card" && patch.kind === "new_unit_card") {
    const c = p.unitCard;
    next = {
      ...p,
      unitCard: { ...c, title: filled(patch.title, c.title), objective: filled(patch.objective, c.objective), method: filled(patch.method, c.method), outcome: filled(patch.outcome, c.outcome) },
    };
  } else if (p.kind === "new_course_recipe" && patch.kind === "new_course_recipe") {
    next = { ...p, recipe: { ...p.recipe, title: filled(patch.title, p.recipe.title) } };
  }
  return { ...st, drafts: st.drafts.map((d) => (d.id === draftId ? { ...d, proposal: next } : d)) };
}

/** 接受草稿，把提案套用到知識庫（編輯過的提案就是接受的內容）。 */
export function acceptDraft(st: DemoState, draftId: string, now: IsoTime): DemoState {
  const draft = st.drafts.find((d) => d.id === draftId);
  if (!draft) return st;
  const p = draft.proposal;

  if (p.kind === "new_unit_card") {
    if (st.unitCards.some((u) => u.id === p.unitCard.id)) return without(st, draftId);
    return without({ ...st, unitCards: [...st.unitCards, p.unitCard] }, draftId);
  }

  if (p.kind === "update_unit_card") {
    const card = st.unitCards.find((u) => u.id === p.unitCardId);
    if (!card) return st;
    const next: UnitCard = {
      ...card,
      // 只補還沒評的卡，不覆蓋講師已經評過的層級
      level: card.level === null ? p.fillLevel : card.level,
      audiences: uniqueTags([...card.audiences, ...p.addTags.audiences]),
      tools: uniqueTags([...card.tools, ...p.addTags.tools]),
      scenarios: uniqueTags([...card.scenarios, ...p.addTags.scenarios]),
    };
    return without({ ...st, unitCards: st.unitCards.map((u) => (u.id === card.id ? next : u)) }, draftId);
  }

  if (p.kind === "new_course_recipe") {
    if (p.unitCardIds.length === 0 || st.recipes.some((r) => r.id === p.recipe.id)) return st;
    // 配方引用的單元卡還沒收進知識庫時，連同還在待審的新單元卡草稿一起收進；兩邊都找不到的略過
    let next = st;
    const unitIds: string[] = [];
    for (const id of p.unitCardIds) {
      if (!next.unitCards.some((u) => u.id === id)) {
        const pending = next.drafts.find((d) => d.proposal.kind === "new_unit_card" && d.proposal.unitCard.id === id);
        if (!pending || pending.proposal.kind !== "new_unit_card") continue;
        next = without({ ...next, unitCards: [...next.unitCards, pending.proposal.unitCard] }, pending.id);
      }
      unitIds.push(id);
    }
    const recipe: CourseRecipe = { ...p.recipe, unitIds };
    return without({ ...next, recipes: [...next.recipes, recipe] }, draftId);
  }

  const card = getModuleCard(st, p.moduleId);
  if (!card) return st;
  // 新版本的骨架是上一版，把被改的單元換成新單元卡；新單元卡還在待審時連同草稿一起收進知識庫（和課程配方一致）
  let next = st;
  let skeleton = moduleCardSkeleton(card);
  for (const change of p.changes) {
    const { unitCardId, replacesUnitCardId } = change;
    if (!skeleton.includes(replacesUnitCardId)) continue;
    if (!next.unitCards.some((u) => u.id === unitCardId)) {
      const pending = next.drafts.find((d) => d.proposal.kind === "new_unit_card" && d.proposal.unitCard.id === unitCardId);
      if (!pending || pending.proposal.kind !== "new_unit_card") continue;
      next = without({ ...next, unitCards: [...next.unitCards, pending.proposal.unitCard] }, pending.id);
    }
    // 換上的單元卡已經在骨架裡就不重複放，只拿掉被換掉的那個
    skeleton = skeleton.includes(unitCardId) ? skeleton.filter((id) => id !== replacesUnitCardId) : skeleton.map((id) => (id === replacesUnitCardId ? unitCardId : id));
  }
  const nextCard: ModuleCard = {
    ...card,
    versions: [
      ...card.versions,
      { version: latestModuleCardVersion(card) + 1, createdAt: now, note: p.changes.map((c) => moduleChangeText(next, c)).join("；"), fromCourseId: draft.fromCourseId, skeletonUnitIds: skeleton },
    ],
  };
  return without({ ...next, moduleCards: next.moduleCards.map((c) => (c.moduleId === card.moduleId ? nextCard : c)) }, draftId);
}
