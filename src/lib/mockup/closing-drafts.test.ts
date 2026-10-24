import { describe, expect, it } from "vitest";
import { demoReducer, type DemoAction } from "./actions";
import { finalArtifacts } from "./closing";
import { canExcludeUnit, moduleChangeText, pendingUsageIncrease } from "./draft-review";
import { getModuleCard, getRecipe, getUnitCard, latestModuleCardVersion, recipeUnitCards, recipesUsingUnit } from "./logic";
import { importProposals } from "./import-script";
import { initialState, type DemoState } from "./state";
import { closingDrafts } from "./closing-drafts";
import { courseTools, recipeSpec } from "./tags";
import type { DraftProposal, KnowledgeDraft } from "./types";

/**
 * 結案後的知識庫草稿（#60）。示範課程是「請款簽核先導班」（c-pa-pilot，F 公司）：
 * 「雲端流程上手（請款版）」是骨架單元改過、「核准與退回分支」與「上線檢查表」照用、
 * 「F 公司請款單逾期對帳」是新做的單元，而且帶著客戶代號。
 */

const COURSE = "c-pa-pilot";
const run = (actions: DemoAction[], from: DemoState = initialState()) => actions.reduce(demoReducer, from);
const closed = () => run([{ type: "course/close", courseId: COURSE }]);
const draftsOf = <K extends DraftProposal["kind"]>(st: DemoState, kind: K) =>
  st.drafts.filter((d): d is KnowledgeDraft & { proposal: Extract<DraftProposal, { kind: K }> } => d.proposal.kind === kind);
const only = <K extends DraftProposal["kind"]>(st: DemoState, kind: K) => {
  const found = draftsOf(st, kind);
  expect(found).toHaveLength(1);
  return found[0];
};
const accept = (draftId: string): DemoAction => ({ type: "draft/accept", draftId });
const NEW_UNIT_TITLE = "F 公司請款單逾期對帳";
const MODIFIED_TITLE = "雲端流程上手（請款版）";
const unitDraftByTitle = (st: DemoState, title: string) => draftsOf(st, "new_unit_card").find((d) => d.proposal.unitCard.title === title)!;
const updateDraftFor = (st: DemoState, cardId: string) => draftsOf(st, "update_unit_card").find((d) => d.proposal.unitCardId === cardId);

describe("結案產生草稿", () => {
  it("還沒結案時沒有草稿；結案後產生四種提案，來源是這門課程", () => {
    expect(initialState().drafts).toEqual([]);
    const st = closed();
    expect(new Set(st.drafts.map((d) => d.proposal.kind))).toEqual(
      new Set(["new_unit_card", "update_unit_card", "new_course_recipe", "module_card_version"]),
    );
    for (const d of st.drafts) {
      expect(d).toMatchObject({ fromCourseId: COURSE, importedFileName: null, trigger: "closing", createdAt: st.now });
    }
  });

  it("結案閘沒過、或重複結案，不會產生（也不會重複產生）草稿", () => {
    expect(run([{ type: "course/close", courseId: "c-claude-intro" }]).drafts).toEqual([]);
    const once = closed();
    expect(demoReducer(once, { type: "course/close", courseId: COURSE }).drafts).toHaveLength(once.drafts.length);
  });

  it("草稿記下依據的藍圖版本與各天最終版（簡報，以及有動手環節那天的手冊；講師最後上傳的版本）", () => {
    const st = closed();
    for (const d of st.drafts) expect(d.basis).toEqual({ blueprintVersion: 2, finalArtifactIds: ["a-pp-slides-2", "a-pp-handbook-2"] });
  });

  it("最終版：每天的簡報取講師上傳的最新一版", () => {
    const course = initialState().courses.find((c) => c.id === "c-gas-two-day")!;
    // 第一天簡報有講師上傳的 v2；其他都是 AI 產的，不算
    expect(finalArtifacts(course).map((a) => a.id)).toEqual(["a-gas-slides-d1-2"]);
  });

  it("新單元卡：藍圖裡要改、新做的單元各一張，內容與標籤取自單元與課程", () => {
    const st = closed();
    const drafts = draftsOf(st, "new_unit_card");
    expect(drafts.map((d) => d.proposal.unitCard.title)).toEqual([MODIFIED_TITLE, NEW_UNIT_TITLE]);
    const card = unitDraftByTitle(st, NEW_UNIT_TITLE).proposal.unitCard;
    expect(card).toMatchObject({
      moduleId: "A4",
      minutes: 90,
      objective: "把 F 公司財務部逾期三天的請款單自動對帳並提醒",
      outcome: "F 公司財務部的逾期對帳流程",
      audiences: ["特定職能"],
      tools: ["Power Automate", "Microsoft Teams"],
      scenarios: ["文書", "客服與信件"],
    });
    expect(getUnitCard(st, card.id)).toBeUndefined(); // 還沒接受，知識庫沒有
  });

  it("更新既有單元卡：沿用的單元各一份，只補這門課帶來的新標籤", () => {
    const st = closed();
    expect(draftsOf(st, "update_unit_card").map((d) => d.proposal.unitCardId)).toEqual(["uc-a4-approval", "uc-b3-golive"]);
    const approval = updateDraftFor(st, "uc-a4-approval")!.proposal;
    // 單元卡原本是 特定職能／Power Automate、Teams／文書；課程多了「客服與信件」
    expect(approval.addTags).toEqual({ audiences: [], tools: [], scenarios: ["客服與信件"] });
    // B 模組（不綁工具的方法）的單元不補工具標籤
    expect(updateDraftFor(st, "uc-b3-golive")!.proposal.addTags).toEqual({
      audiences: [],
      tools: [],
      scenarios: ["客服與信件"],
    });
  });

  it("新單元卡帶藍圖單元的應用層級，未評與純方法（na）都原樣保留", () => {
    const st = closed();
    const bpUnits = initialState().courses.find((c) => c.id === COURSE)!.blueprint.days.flatMap((d) => d.slots.flatMap((s) => s.units));
    for (const title of [NEW_UNIT_TITLE, MODIFIED_TITLE]) {
      expect(unitDraftByTitle(st, title).proposal.unitCard.level).toBe(bpUnits.find((u) => u.title === title)!.level);
    }
    expect(unitDraftByTitle(st, NEW_UNIT_TITLE).proposal.unitCard.level).toBe("L5");
    const course = (level: "na" | null) => {
      const s = initialState();
      const c = s.courses.find((x) => x.id === COURSE)!;
      c.blueprint.days.flatMap((d) => d.slots.flatMap((sl) => sl.units)).find((u) => u.title === NEW_UNIT_TITLE)!.level = level;
      return demoReducer(s, { type: "course/close", courseId: COURSE });
    };
    expect(unitDraftByTitle(course("na"), NEW_UNIT_TITLE).proposal.unitCard.level).toBe("na");
    expect(unitDraftByTitle(course(null), NEW_UNIT_TITLE).proposal.unitCard.level).toBeNull();
  });

  it("更新草稿：單元卡未評、藍圖單元有評（含 na）時提議補上層級；單元卡已有層級或藍圖也未評則不動", () => {
    const withCardLevel = (cardId: string, level: "L2" | "na" | null, bpLevel?: "L4" | "na" | null) => {
      const s = initialState();
      s.unitCards.find((u) => u.id === cardId)!.level = level;
      if (bpLevel !== undefined) {
        s.courses.find((c) => c.id === COURSE)!.blueprint.days.flatMap((d) => d.slots.flatMap((sl) => sl.units)).find((u) => u.source?.id === cardId)!.level = bpLevel;
      }
      return demoReducer(s, { type: "course/close", courseId: COURSE });
    };
    // 單元卡未評、藍圖單元是 L3（approval）→ 提議 L3
    expect(updateDraftFor(withCardLevel("uc-a4-approval", null), "uc-a4-approval")!.proposal.fillLevel).toBe("L3");
    // 藍圖單元是 na（golive）→ 提議 na
    expect(updateDraftFor(withCardLevel("uc-b3-golive", null), "uc-b3-golive")!.proposal.fillLevel).toBe("na");
    // 單元卡已有層級 → 不提議，也不覆蓋
    expect(updateDraftFor(withCardLevel("uc-a4-approval", "L2"), "uc-a4-approval")!.proposal.fillLevel).toBeNull();
    // 兩邊都未評 → 沒東西可補
    expect(updateDraftFor(withCardLevel("uc-a4-approval", null, null), "uc-a4-approval")!.proposal.fillLevel).toBeNull();
  });

  it("新課程配方：依藍圖順序引用單元卡，標籤取自課程，名稱是中性組成（不含課程名稱與客戶），狀態已交付、上課年月取最後一個場次", () => {
    const st = closed();
    const { recipe, unitCardIds } = only(st, "new_course_recipe").proposal;
    expect(recipe).not.toHaveProperty("client");
    expect(recipe.title).not.toContain("請款簽核先導班");
    expect(recipe.title).not.toContain("F 公司");
    expect(recipe).toMatchObject({
      title: "金融・A4 雲端自動化＋B3 AI 治理與風險・一日",
      status: "delivered",
      heldOn: "2026-09",
      audiences: ["特定職能"],
      tools: ["Power Automate", "Microsoft Teams"],
      industries: ["金融"],
      scenarios: ["文書", "客服與信件"],
    });
    const modified = unitDraftByTitle(st, MODIFIED_TITLE).proposal.unitCard.id;
    const fresh = unitDraftByTitle(st, NEW_UNIT_TITLE).proposal.unitCard.id;
    expect(unitCardIds).toEqual([modified, "uc-a4-approval", fresh, "uc-b3-golive"]);
  });

  it("模組卡新版本：只有骨架單元被改過的模組才提議，改動列出改了哪個單元", () => {
    const st = closed();
    const draft = only(st, "module_card_version");
    expect(draft.proposal.moduleId).toBe("A4");
    expect(draft.proposal.changes).toHaveLength(1);
    expect(draft.proposal.changes[0]).toEqual({ unitCardId: unitDraftByTitle(st, MODIFIED_TITLE).proposal.unitCard.id, replacesUnitCardId: "uc-a4-cloud-first" });
    expect(moduleChangeText(st, draft.proposal.changes[0])).toContain(MODIFIED_TITLE);
    expect(draft.proposal.changes[0].unitCardId).toBe(unitDraftByTitle(st, MODIFIED_TITLE).proposal.unitCard.id);
  });
});

describe("接受提案後，知識庫的變化", () => {
  it("新單元卡：多一張單元卡（內容照提案），草稿消失；用過的配方還是 0", () => {
    const st0 = closed();
    const d = unitDraftByTitle(st0, NEW_UNIT_TITLE);
    const st = run([accept(d.id)], st0);
    expect(getUnitCard(st, d.proposal.unitCard.id)).toEqual(d.proposal.unitCard);
    expect(st.unitCards).toHaveLength(st0.unitCards.length + 1);
    expect(st.drafts.map((x) => x.id)).not.toContain(d.id);
    expect(recipesUsingUnit(st, d.proposal.unitCard.id)).toEqual([]);
  });

  it("更新既有單元卡：接受後補上提議的層級，已有層級的卡不被覆蓋", () => {
    const s0 = initialState();
    s0.unitCards.find((u) => u.id === "uc-a4-approval")!.level = null;
    const st0 = demoReducer(s0, { type: "course/close", courseId: COURSE });
    expect(getUnitCard(run([accept(updateDraftFor(st0, "uc-a4-approval")!.id)], st0), "uc-a4-approval")!.level).toBe("L3");
    // 草稿產生後講師手動評成 L2，接受時不覆蓋
    const rated = { ...st0, unitCards: st0.unitCards.map((u) => (u.id === "uc-a4-approval" ? { ...u, level: "L2" as const } : u)) };
    expect(getUnitCard(run([accept(updateDraftFor(rated, "uc-a4-approval")!.id)], rated), "uc-a4-approval")!.level).toBe("L2");
  });

  it("更新既有單元卡：補上新標籤（不重複）；用過的配方數不在這裡變，要等課程配方收進", () => {
    const st0 = closed();
    const d = updateDraftFor(st0, "uc-b3-golive")!;
    const before = recipesUsingUnit(st0, "uc-b3-golive").length;
    const st = run([accept(d.id)], st0);
    const card = getUnitCard(st, "uc-b3-golive")!;
    expect(card.audiences).toEqual(["特定職能", "主管經營層"]);
    expect(card.tools).toEqual([]);
    expect(card.scenarios).toEqual(["文書", "客服與信件"]);
    expect(card.id).toBe("uc-b3-golive");
    expect(st.unitCards).toHaveLength(st0.unitCards.length);
    expect(recipesUsingUnit(st, "uc-b3-golive")).toHaveLength(before);
    expect(st.drafts.map((x) => x.id)).not.toContain(d.id);
  });

  it("新課程配方：收進配方，並帶進還沒接受的新單元卡；沿用的單元卡用過的配方 +1", () => {
    const st0 = closed();
    const d = only(st0, "new_course_recipe");
    const usedBefore = { approval: recipesUsingUnit(st0, "uc-a4-approval").length, golive: recipesUsingUnit(st0, "uc-b3-golive").length };
    const st = run([accept(d.id)], st0);
    const recipe = getRecipe(st, d.proposal.recipe.id)!;
    expect(recipe).toMatchObject({ title: d.proposal.recipe.title, status: "delivered", heldOn: "2026-09" });
    expect(recipe).not.toHaveProperty("client");
    expect(recipe.unitIds).toEqual(d.proposal.unitCardIds);
    expect(recipeUnitCards(st, recipe).map((u) => u.title)).toEqual([MODIFIED_TITLE, "核准與退回分支", NEW_UNIT_TITLE, "上線檢查表"]);
    expect(recipesUsingUnit(st, "uc-a4-approval")).toHaveLength(usedBefore.approval + 1);
    expect(recipesUsingUnit(st, "uc-b3-golive")).toHaveLength(usedBefore.golive + 1);
    expect(recipeSpec(st, recipe)).toBe("一日");
    // 新單元卡跟著收進，對應的單元卡草稿不會重複
    expect(draftsOf(st, "new_unit_card")).toEqual([]);
    expect(st.unitCards).toHaveLength(st0.unitCards.length + 2);
    expect(st.drafts.map((x) => x.id)).not.toContain(d.id);
  });

  it("先接受新單元卡、再接受課程配方：單元卡不會重複", () => {
    const st0 = closed();
    const unit = unitDraftByTitle(st0, NEW_UNIT_TITLE);
    const recipeDraft = only(st0, "new_course_recipe");
    const st = run([accept(unit.id), accept(recipeDraft.id)], st0);
    expect(st.unitCards.filter((u) => u.title === NEW_UNIT_TITLE)).toHaveLength(1);
    expect(getRecipe(st, recipeDraft.proposal.recipe.id)!.unitIds).toContain(unit.proposal.unitCard.id);
  });

  it("模組卡新版本：多一版，備註是各條改動，來源是這門課程", () => {
    const st0 = closed();
    const d = only(st0, "module_card_version");
    const before = latestModuleCardVersion(getModuleCard(st0, "A4")!);
    const st = run([accept(d.id)], st0);
    const card = getModuleCard(st, "A4")!;
    expect(latestModuleCardVersion(card)).toBe(before + 1);
    expect(card.versions.at(-1)).toMatchObject({ fromCourseId: COURSE, note: d.proposal.changes.map((c) => moduleChangeText(st0, c)).join("；") });
    expect(st.drafts.map((x) => x.id)).not.toContain(d.id);
  });

  it("捨棄單元卡以外的草稿：知識庫不變", () => {
    const st0 = closed();
    const d = only(st0, "module_card_version");
    const st = run([{ type: "draft/discard", draftId: d.id }], st0);
    expect({ ...st, now: st0.now, drafts: [] }).toEqual({ ...st0, drafts: [] });
    expect(st.drafts).toHaveLength(st0.drafts.length - 1);
  });
});

describe("審核：排除單元", () => {
  it("排除新做的單元：它的單元卡草稿、配方裡的位置一起拿掉，接受後知識庫沒有它", () => {
    const st0 = closed();
    const recipeDraft = only(st0, "new_course_recipe");
    const fresh = unitDraftByTitle(st0, NEW_UNIT_TITLE).proposal.unitCard.id;
    const st1 = run([{ type: "draft/excludeUnit", draftId: recipeDraft.id, unitCardId: fresh }], st0);
    expect(draftsOf(st1, "new_unit_card").map((d) => d.proposal.unitCard.title)).toEqual([MODIFIED_TITLE]);
    expect(only(st1, "new_course_recipe").proposal.unitCardIds).not.toContain(fresh);
    const st = run([accept(recipeDraft.id)], st1);
    expect(getUnitCard(st, fresh)).toBeUndefined();
    expect(recipeUnitCards(st, getRecipe(st, recipeDraft.proposal.recipe.id)!).map((u) => u.title)).toEqual([MODIFIED_TITLE, "核准與退回分支", "上線檢查表"]);
  });

  it("排除沿用的單元：更新草稿與配方裡的位置一起拿掉，該單元卡用過的配方數不增加", () => {
    const st0 = closed();
    const recipeDraft = only(st0, "new_course_recipe");
    const before = recipesUsingUnit(st0, "uc-a4-approval").length;
    const st = run([{ type: "draft/excludeUnit", draftId: recipeDraft.id, unitCardId: "uc-a4-approval" }, accept(recipeDraft.id)], st0);
    expect(updateDraftFor(st, "uc-a4-approval")).toBeUndefined();
    expect(recipesUsingUnit(st, "uc-a4-approval")).toHaveLength(before);
  });

  it("排除造成模組卡改動的單元：那條改動拿掉，沒有改動就不提議升版", () => {
    const st0 = closed();
    const modified = unitDraftByTitle(st0, MODIFIED_TITLE).proposal.unitCard.id;
    const st = run([{ type: "draft/excludeUnit", draftId: only(st0, "new_course_recipe").id, unitCardId: modified }], st0);
    expect(draftsOf(st, "module_card_version")).toEqual([]);
  });

  it("捨棄新單元卡草稿等於排除：配方裡不會留下指向不存在單元卡的位置", () => {
    const st0 = closed();
    const unit = unitDraftByTitle(st0, NEW_UNIT_TITLE);
    const st = run([{ type: "draft/discard", draftId: unit.id }], st0);
    expect(only(st, "new_course_recipe").proposal.unitCardIds).not.toContain(unit.proposal.unitCard.id);
  });

  it("單元全被排除的課程配方不能接受", () => {
    let st = closed();
    const recipeDraft = only(st, "new_course_recipe");
    for (const id of recipeDraft.proposal.unitCardIds) st = run([{ type: "draft/excludeUnit", draftId: recipeDraft.id, unitCardId: id }], st);
    const after = run([accept(recipeDraft.id)], st);
    expect(after.recipes).toEqual(st.recipes);
    expect(after.drafts.map((d) => d.id)).toContain(recipeDraft.id);
  });
});

describe("審核：改寫含客戶機密的文字", () => {
  it("改寫單元卡的標題、目標、教學方式、成果與課程配方的名稱後接受，知識庫裡不再有客戶代號", () => {
    const st0 = closed();
    const unit = unitDraftByTitle(st0, NEW_UNIT_TITLE);
    const recipeDraft = only(st0, "new_course_recipe");
    const st = run(
      [
        { type: "draft/rewrite", draftId: unit.id, patch: { kind: "new_unit_card", title: "請款單逾期對帳", objective: "把逾期三天的請款單自動對帳並提醒", method: "範例拆解＋動手練習", outcome: "逾期對帳流程" } },
        { type: "draft/rewrite", draftId: recipeDraft.id, patch: { kind: "new_course_recipe", title: "金融業請款簽核先導班" } },
        accept(recipeDraft.id),
      ],
      st0,
    );
    const recipe = getRecipe(st, recipeDraft.proposal.recipe.id)!;
    expect(recipe).toMatchObject({ title: "金融業請款簽核先導班" });
    expect(getUnitCard(st, unit.proposal.unitCard.id)).toMatchObject({ title: "請款單逾期對帳", objective: "把逾期三天的請款單自動對帳並提醒", method: "範例拆解＋動手練習", outcome: "逾期對帳流程" });
    const added = [recipe, ...recipeUnitCards(st, recipe).filter((u) => !st0.unitCards.some((x) => x.id === u.id))];
    expect(JSON.stringify(added)).not.toContain("F 公司");
  });

  it("改寫單元卡標題後，模組卡新版本的變更說明跟著變，接受後版本備註也不留原標題", () => {
    const st0 = closed();
    const d = only(st0, "module_card_version");
    const unit = unitDraftByTitle(st0, MODIFIED_TITLE);
    const change = d.proposal.changes[0];
    expect(moduleChangeText(st0, change)).toContain(MODIFIED_TITLE);
    const st1 = run([{ type: "draft/rewrite", draftId: unit.id, patch: { kind: "new_unit_card", title: "雲端流程上手（財務版）" } }], st0);
    const text = moduleChangeText(st1, only(st1, "module_card_version").proposal.changes[0]);
    expect(text).toContain("雲端流程上手（財務版）");
    expect(text).not.toContain(MODIFIED_TITLE);
    const st = run([accept(d.id)], st1);
    expect(getModuleCard(st, "A4")!.versions.at(-1)!.note).toContain("雲端流程上手（財務版）");
    expect(getModuleCard(st, "A4")!.versions.at(-1)!.note).not.toContain(MODIFIED_TITLE);
  });

  it("模組卡新版本沒有可改寫的自由文字：rewrite 對它不生效", () => {
    const st0 = closed();
    const d = only(st0, "module_card_version");
    // @ts-expect-error module_card_version 不再是可改寫的種類
    const st = run([{ type: "draft/rewrite", draftId: d.id, patch: { kind: "module_card_version", index: 0, text: "x" } }], st0);
    expect(st.drafts).toEqual(st0.drafts);
  });

  it("教學方式改寫在接受時套用；空白的教學方式忽略", () => {
    const st0 = closed();
    const unit = unitDraftByTitle(st0, NEW_UNIT_TITLE);
    const original = unit.proposal.unitCard.method;
    const st = run(
      [
        { type: "draft/rewrite", draftId: unit.id, patch: { kind: "new_unit_card", method: "情境演練＋小組討論" } },
        { type: "draft/rewrite", draftId: unit.id, patch: { kind: "new_unit_card", method: "   " } },
      ],
      st0,
    );
    expect(unitDraftByTitle(st, NEW_UNIT_TITLE).proposal.unitCard.method).toBe("情境演練＋小組討論");
    expect(original).not.toBe("情境演練＋小組討論");
    const accepted = run([accept(unit.id)], st);
    expect(getUnitCard(accepted, unit.proposal.unitCard.id)!.method).toBe("情境演練＋小組討論");
  });

  it("fixture 的課程配方沒有客戶欄位，名稱也不含任何專案的客戶公司代號", () => {
    const st = initialState();
    const companies = st.projects.map((p) => p.clientContext.company).filter(Boolean);
    expect(companies.length).toBeGreaterThan(0);
    for (const r of st.recipes) {
      expect(r, r.id).not.toHaveProperty("client");
      expect(r.title, r.id).not.toMatch(/[A-Z] 公司/);
      for (const c of companies) expect(r.title, r.id).not.toContain(c);
    }
  });

  it("種類對不上的改寫、空白標題都被忽略", () => {
    const st0 = closed();
    const unit = unitDraftByTitle(st0, NEW_UNIT_TITLE);
    const st = run(
      [
        { type: "draft/rewrite", draftId: unit.id, patch: { kind: "new_course_recipe", title: "x" } },
        { type: "draft/rewrite", draftId: unit.id, patch: { kind: "new_unit_card", title: "  " } },
      ],
      st0,
    );
    expect(unitDraftByTitle(st, NEW_UNIT_TITLE).proposal.unitCard.title).toBe(NEW_UNIT_TITLE);
  });
});

describe("匯入過往講義", () => {
  it("產生一份課程配方草稿與每個單元一份新單元卡草稿，接受後依序收進", () => {
    const proposals = importProposals("2025 行政班講義.pdf", "A2", "imp");
    const st0 = run([{ type: "draft/import", id: "imp", fileName: "2025 行政班講義.pdf", proposals }]);
    expect(st0.drafts.every((d) => d.trigger === "import" && d.fromCourseId === null && d.importedFileName === "2025 行政班講義.pdf")).toBe(true);
    const recipeDraft = only(st0, "new_course_recipe");
    const st = run([accept(recipeDraft.id)], st0);
    const recipe = getRecipe(st, recipeDraft.proposal.recipe.id)!;
    expect(recipeUnitCards(st, recipe).map((u) => [u.moduleId, u.title])).toEqual([
      ["A2", "把手冊切段後上傳"],
      ["A2", "設定只根據文件回答"],
    ]);
    expect(st.drafts).toEqual([]);
  });
});

describe("審核的邊界：已經定案的單元", () => {
  it("「用過的配方 +1」只在課程配方還待審時預告；配方收進或捨棄後不再預告", () => {
    const st0 = closed();
    const update = updateDraftFor(st0, "uc-a4-approval")!;
    const recipeDraft = only(st0, "new_course_recipe");
    expect(pendingUsageIncrease(st0, update)).toBe(true);
    const accepted = run([accept(recipeDraft.id)], st0);
    expect(pendingUsageIncrease(accepted, updateDraftFor(accepted, "uc-a4-approval")!)).toBe(false);
    const discarded = run([{ type: "draft/discard", draftId: recipeDraft.id }], st0);
    expect(pendingUsageIncrease(discarded, updateDraftFor(discarded, "uc-a4-approval")!)).toBe(false);
  });

  it("新單元卡已經單獨收進知識庫後，不能再從配方排除（否則留下沒有配方的孤兒單元卡）", () => {
    const st0 = closed();
    const unit = unitDraftByTitle(st0, NEW_UNIT_TITLE);
    const recipeDraft = only(st0, "new_course_recipe");
    const st1 = run([accept(unit.id)], st0);
    expect(canExcludeUnit(st1, recipeDraft.id, unit.proposal.unitCard.id)).toBe(false);
    expect(run([{ type: "draft/excludeUnit", draftId: recipeDraft.id, unitCardId: unit.proposal.unitCard.id }], st1)).toEqual({
      ...st1,
      now: expect.any(String),
    });
    // 還沒收進的新單元卡、待審更新草稿的既有單元卡可以排除
    expect(canExcludeUnit(st0, recipeDraft.id, unit.proposal.unitCard.id)).toBe(true);
    expect(canExcludeUnit(st0, recipeDraft.id, "uc-a4-approval")).toBe(true);
  });
});

describe("結案草稿的標籤來源（#74）", () => {
  const pilot = (st: DemoState) => st.courses.find((c) => c.id === COURSE)!;
  const newCards = (drafts: KnowledgeDraft[]) =>
    drafts.flatMap((d) => (d.proposal.kind === "new_unit_card" ? [d.proposal.unitCard] : []));

  it("課程配方：課程的三組標籤，加上由藍圖推得的工具", () => {
    const st = initialState();
    const course = {
      ...pilot(st),
      audiences: ["全員" as const],
      industries: ["製造" as const],
      scenarios: ["簡報" as const],
      blueprint: { ...pilot(st).blueprint, tools: [{ name: "Excel", plan: "paid" as const, confirmedWithClient: true }] },
    };
    const recipe = closingDrafts(st, course).flatMap((d) => (d.proposal.kind === "new_course_recipe" ? [d.proposal.recipe] : []))[0];
    expect(recipe).toMatchObject({ audiences: ["全員"], tools: ["Excel"], industries: ["製造"], scenarios: ["簡報"] });
  });

  it("新單元卡：對象與場景沿用課程；A 模組的單元有工具，B 模組的單元沒有", () => {
    const st = initialState();
    const base = pilot(st);
    const blueprint = structuredClone(base.blueprint);
    // 把下午第一個單元（新做的 A4）換成新做的 B3
    const unit = blueprint.days[0].slots[1].units[0];
    blueprint.days[0].slots[1].units[0] = { ...unit, module: "B3", title: "資料分級討論", level: "na" };
    const cards = newCards(closingDrafts(st, { ...base, blueprint }));
    const a = cards.find((c) => c.title === MODIFIED_TITLE)!;
    const b = cards.find((c) => c.title === "資料分級討論")!;
    expect(a.moduleId).toBe("A4");
    expect(a.tools).toEqual(courseTools(base));
    expect(a.tools).toEqual(["Power Automate", "Microsoft Teams"]);
    expect(b.moduleId).toBe("B3");
    expect(b.tools).toEqual([]);
    for (const c of [a, b]) expect(c).toMatchObject({ audiences: base.audiences, scenarios: base.scenarios });
  });

  it("工具來自藍圖，不是課程上的舊標籤：藍圖換了工具，草稿跟著換", () => {
    const st = initialState();
    const base = pilot(st);
    const blueprint = { ...base.blueprint, tools: [{ name: "Claude Code", plan: "paid" as const, confirmedWithClient: true }] };
    const drafts = closingDrafts(st, { ...base, blueprint });
    for (const c of newCards(drafts)) expect(c.tools).toEqual(c.moduleId.startsWith("A") ? ["Claude Code"] : []);
  });
});
