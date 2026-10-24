import { latestBlueprintVersion, moduleCardSkeleton, sessionEndsAt, sessionsOfCourse } from "./logic";
import { finalArtifacts } from "./closing";
import type { DemoState } from "./state";
import { courseSpec, courseTools, uniqueTags } from "./tags";
import { getModule, moduleLabel } from "@/lib/blueprint/modules";
import type { Course, DraftProposal, KnowledgeDraft, ModuleCardChange, ModuleId, UnitCard } from "./types";

/**
 * 課程結案後的知識庫草稿（#60）。設計稿裡「AI 把結案的課程拆成草稿」是這支確定性的純函式：
 * 輸入是結案課程的最新一版藍圖（加上它的最終版身分），輸出是待講師審核的草稿，不碰知識庫本身。
 *
 * 拆法（每個單元依序編號 n，從 1 起算）：
 * - 來源是單元卡、沿用程度「沿用」、而且那張單元卡還在知識庫 → 更新既有單元卡（補上這門課帶來的新標籤）。
 *   同一張單元卡在藍圖裡出現多次只算一份。單元卡還是未評、藍圖單元有評時，更新草稿另外提議補上應用層級（fillLevel）。
 * - 其餘（要改、新做、沒有來源、來源是別的課程、單元卡已不存在）→ 新單元卡，id 預先定為 `uc-<課程 id>-<n>`，
 *   應用層級照藍圖單元（未評、純方法也原樣保留）。
 * - 整門課程 → 一份課程配方，id 為 `rc-<課程 id>`（一門課最多一份配方），單元依藍圖順序引用上面兩種單元卡。
 *   這門課的配方已經收進知識庫（重新開啟後再結案）時，這份草稿是「更新這份配方」，接受時取代它的單元序列、上課年月與標籤。
 * - 草稿與新單元卡的 id 每次結案都不同：第一次結案是 `uc-<課程 id>-<n>`、`d-<課程 id>-<i>`，
 *   之後的結案在課程 id 後面加 `r<k>-`（k 是第幾次結案，取第一個不與知識庫或待審草稿撞號的），避免和已收進的單元卡撞號。
 * - 單元來源是某模組卡（目前骨架）裡的單元卡、而且沿用程度是「要改」→ 那個模組卡的新版本，每個這樣的單元一條改動，
 *   記下被換掉的骨架單元（replacesUnitCardId）與換上的新單元卡；接受時新版本的骨架就是上一版把它換掉。
 *   沒有骨架被改過的模組不提議升版。
 *
 * 標籤來源（#74）：課程配方 = 課程存的對象、產業、應用場景，加上由藍圖推得的工具（courseTools）；
 * 單元卡（新的與更新的）= 對象與應用場景沿用課程，工具只給 A 模組的單元（取課程的工具），
 * B 模組是不綁工具的方法，不給工具標籤。
 *
 * 「用過的配方 +1」不存計數：單元卡被哪些配方用過由配方推得（logic.ts 的 recipesUsingUnit），
 * 所以 +1 發生在新課程配方被接受、把單元卡寫進 unitIds 的那一刻。
 */
/**
 * 結案草稿的配方名稱：由內容組成的中性名稱「產業・模組・規格」，不沿用課程名稱、也不放客戶。
 * 產業取課程的產業標籤（沒有就「通用」）、模組取藍圖單元用到的模組（依出現順序、去重）、規格由總時數推得（沒有時數就省略）；
 * 講師可以再改寫。
 */
export function neutralRecipeTitle(course: Course, moduleIds: ModuleId[]): string {
  const industries = uniqueTags(course.industries);
  const modules = [...new Set(moduleIds)].map(moduleLabel);
  return [industries.length > 0 ? industries.join("、") : "通用", modules.join("＋"), courseSpec(course)].filter(Boolean).join("・");
}

export function closingDrafts(st: DemoState, course: Course): KnowledgeDraft[] {
  const units = course.blueprint.days.flatMap((d) => d.slots.flatMap((s) => s.units)).map((unit, i) => ({ unit, n: i + 1 }));
  const courseTags = {
    audiences: uniqueTags(course.audiences),
    tools: courseTools(course),
    scenarios: uniqueTags(course.scenarios),
  };
  // 單元卡的標籤：工具只給 A 模組的單元
  const unitTagsFor = (module: ModuleId) => ({ ...courseTags, tools: getModule(module).kind === "A" ? courseTags.tools : [] });

  // 這次結案是第幾輪：新單元卡 id 不能和知識庫或待審草稿裡的撞號
  const taken = new Set([...st.unitCards.map((u) => u.id), ...st.drafts.flatMap((d) => (d.proposal.kind === "new_unit_card" ? [d.proposal.unitCard.id] : []))]);
  const roundPrefix = (k: number) => (k === 1 ? "" : `r${k}-`);
  let round = 1;
  while (units.some(({ n }) => taken.has(`uc-${course.id}-${roundPrefix(round)}${n}`))) round += 1;
  const cardId = (n: number) => `uc-${course.id}-${roundPrefix(round)}${n}`;

  const newCards: UnitCard[] = [];
  const updates: Extract<DraftProposal, { kind: "update_unit_card" }>[] = [];
  const cardIds: string[] = [];
  const moduleChanges = new Map<ModuleId, ModuleCardChange[]>();

  for (const { unit, n } of units) {
    const source = unit.source;
    const existing = source?.kind === "unit_card" ? st.unitCards.find((u) => u.id === source.id) : undefined;
    const tags = unitTagsFor(unit.module);
    if (existing && unit.reuse === "reuse") {
      if (!cardIds.includes(existing.id)) {
        cardIds.push(existing.id);
        updates.push({
          kind: "update_unit_card",
          unitCardId: existing.id,
          addTags: {
            audiences: tags.audiences.filter((a) => !existing.audiences.includes(a)),
            tools: tags.tools.filter((t) => !existing.tools.includes(t)),
            scenarios: tags.scenarios.filter((s) => !existing.scenarios.includes(s)),
          },
          // 單元卡還沒評、藍圖單元評過了（含純方法 na）才提議補上
          fillLevel: existing.level === null ? unit.level : null,
        });
      }
      continue;
    }
    const card: UnitCard = {
      id: cardId(n),
      moduleId: unit.module,
      title: unit.title,
      minutes: unit.minutes,
      level: unit.level,
      objective: unit.objective,
      method: unit.method,
      outcome: unit.outcome,
      ...tags,
    };
    newCards.push(card);
    cardIds.push(card.id);
    if (existing && unit.reuse === "modify") {
      const moduleCard = st.moduleCards.find((m) => moduleCardSkeleton(m).includes(existing.id));
      if (moduleCard) {
        const change: ModuleCardChange = { unitCardId: card.id, replacesUnitCardId: existing.id };
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
        title: neutralRecipeTitle(course, units.map((x) => x.unit.module)),
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
    id: `d-${course.id}-${roundPrefix(round)}${i + 1}`,
    fromCourseId: course.id,
    importedFileName: null,
    createdAt: st.now,
    trigger: "closing",
    basis,
    proposal,
  }));
}
