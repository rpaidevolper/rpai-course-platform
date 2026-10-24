import { latestBlueprintVersion, sessionEndsAt, sessionsOfCourse } from "./logic";
import { finalArtifacts } from "./closing";
import type { DemoState } from "./state";
import { uniqueTags } from "./tags";
import type { Course, DraftProposal, KnowledgeDraft, ModuleCardChange, ModuleId, UnitCard } from "./types";

/**
 * 課程結案後的知識庫草稿（#60）。設計稿裡「AI 把結案的課程拆成草稿」是這支確定性的純函式：
 * 輸入是結案課程的最新一版藍圖（加上它的最終版身分），輸出是待講師審核的草稿，不碰知識庫本身。
 *
 * 拆法（每個單元依序編號 n，從 1 起算）：
 * - 來源是單元卡、沿用程度「沿用」、而且那張單元卡還在知識庫 → 更新既有單元卡（補上這門課帶來的新標籤）。
 *   同一張單元卡在藍圖裡出現多次只算一份。
 * - 其餘（要改、新做、沒有來源、來源是別的課程、單元卡已不存在）→ 新單元卡，id 預先定為 `uc-<課程 id>-<n>`。
 * - 整門課程 → 一份新課程配方，id 為 `rc-<課程 id>`，單元依藍圖順序引用上面兩種單元卡。
 * - 單元來源是某模組卡骨架裡的單元卡、而且沿用程度是「要改」→ 那個模組卡的新版本，每個這樣的單元一條改動。
 *   沒有骨架被改過的模組不提議升版。
 *
 * 「用過的配方 +1」不存計數：單元卡被哪些配方用過由配方推得（logic.ts 的 recipesUsingUnit），
 * 所以 +1 發生在新課程配方被接受、把單元卡寫進 unitIds 的那一刻。
 */
export function closingDrafts(st: DemoState, course: Course): KnowledgeDraft[] {
  const project = st.projects.find((p) => p.id === course.projectId);
  const units = course.blueprint.days.flatMap((d) => d.slots.flatMap((s) => s.units)).map((unit, i) => ({ unit, n: i + 1 }));
  const courseTags = {
    audiences: uniqueTags(course.audiences),
    tools: uniqueTags(course.tools),
    scenarios: uniqueTags(course.scenarios),
  };

  const newCards: UnitCard[] = [];
  const updates: Extract<DraftProposal, { kind: "update_unit_card" }>[] = [];
  const cardIds: string[] = [];
  const moduleChanges = new Map<ModuleId, ModuleCardChange[]>();

  for (const { unit, n } of units) {
    const source = unit.source;
    const existing = source?.kind === "unit_card" ? st.unitCards.find((u) => u.id === source.id) : undefined;
    if (existing && unit.reuse === "reuse") {
      if (!cardIds.includes(existing.id)) {
        cardIds.push(existing.id);
        updates.push({
          kind: "update_unit_card",
          unitCardId: existing.id,
          addTags: {
            audiences: courseTags.audiences.filter((a) => !existing.audiences.includes(a)),
            tools: courseTags.tools.filter((t) => !existing.tools.includes(t)),
            scenarios: courseTags.scenarios.filter((s) => !existing.scenarios.includes(s)),
          },
        });
      }
      continue;
    }
    const card: UnitCard = {
      id: `uc-${course.id}-${n}`,
      moduleId: unit.module,
      title: unit.title,
      minutes: unit.minutes,
      objective: unit.objective,
      method: unit.method,
      outcome: unit.outcome,
      ...courseTags,
    };
    newCards.push(card);
    cardIds.push(card.id);
    if (existing && unit.reuse === "modify") {
      const moduleCard = st.moduleCards.find((m) => m.skeletonUnitIds.includes(existing.id));
      if (moduleCard) {
        const change = { text: `骨架單元「${existing.title}」在這門課改成「${unit.title}」（${unit.minutes} 分）`, unitCardId: card.id };
        moduleChanges.set(moduleCard.moduleId, [...(moduleChanges.get(moduleCard.moduleId) ?? []), change]);
      }
    }
  }

  const lastEnd = sessionsOfCourse(st, course.id)
    .map(sessionEndsAt)
    .sort()
    .at(-1);
  const proposals: DraftProposal[] = [
    {
      kind: "new_course_recipe",
      recipe: {
        id: `rc-${course.id}`,
        title: course.title,
        client: project?.clientContext.company ?? "",
        status: "delivered",
        heldOn: lastEnd ? lastEnd.slice(0, 7) : null,
        audiences: courseTags.audiences,
        tools: courseTags.tools,
        industries: uniqueTags(course.industries),
        scenarios: courseTags.scenarios,
      },
      unitCardIds: cardIds,
    },
    ...newCards.map((unitCard): DraftProposal => ({ kind: "new_unit_card", unitCard })),
    ...updates,
    ...[...moduleChanges].map(([moduleId, changes]): DraftProposal => ({ kind: "module_card_version", moduleId, changes })),
  ];

  const basis = { blueprintVersion: latestBlueprintVersion(course), finalArtifactIds: finalArtifacts(course).map((a) => a.id) };
  return proposals.map((proposal, i) => ({
    id: `d-${course.id}-${i + 1}`,
    fromCourseId: course.id,
    importedFileName: null,
    createdAt: st.now,
    trigger: "closing",
    basis,
    proposal,
  }));
}
