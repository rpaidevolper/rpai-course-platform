import { describe, expect, it } from "vitest";
import { demoReducer, starterBlueprint, type DemoAction, type ModuleVersionPick } from "./actions";
import { getCourse, getModuleCard, getUnitCard, latestModuleCardVersion, moduleCardSkeleton } from "./logic";
import { initialState, type DemoState } from "./state";
import type { DraftProposal, KnowledgeDraft, ModuleId } from "./types";

/** 模組卡版本保存骨架快照（#76）：目前的骨架由最新版本推得，課程來源記錄模組卡版本。 */

const run = (actions: DemoAction[], from: DemoState = initialState()) => actions.reduce(demoReducer, from);
const unitTitles = (st: DemoState, courseId: string) =>
  getCourse(st, courseId)!.blueprint.days.flatMap((d) => d.slots.flatMap((s) => s.units)).map((u) => u.title);

describe("模組卡版本的骨架快照", () => {
  it("每個版本都有骨架快照，每個單元卡 id 都查得到、而且屬於這個模組", () => {
    const st = initialState();
    for (const card of st.moduleCards) {
      for (const v of card.versions) {
        expect(v.skeletonUnitIds.length, `${card.moduleId} v${v.version}`).toBeGreaterThan(0);
        for (const id of v.skeletonUnitIds) {
          expect(getUnitCard(st, id), `${card.moduleId} v${v.version} ${id}`).toBeDefined();
          expect(getUnitCard(st, id)!.moduleId, id).toBe(card.moduleId);
        }
      }
    }
  });

  it("目前的骨架由最新版本推得；指定版本則取那一版的快照，查無該版本是空的", () => {
    const card = getModuleCard(initialState(), "A4")!;
    expect(latestModuleCardVersion(card)).toBe(2);
    expect(moduleCardSkeleton(card)).toEqual(card.versions.find((v) => v.version === 2)!.skeletonUnitIds);
    expect(moduleCardSkeleton(card, 1)).toEqual(["uc-a4-cloud-first", "uc-a4-form-trigger", "uc-a4-overdue"]);
    expect(moduleCardSkeleton(card, 2)).toEqual(["uc-a4-cloud-first", "uc-a4-form-trigger", "uc-a4-overdue", "uc-a4-safety-net"]);
    expect(moduleCardSkeleton(card, 9)).toEqual([]);
  });
});

describe("接受模組卡新版本草稿", () => {
  const COURSE = "c-pa-pilot";
  const closed = () => run([{ type: "course/close", courseId: COURSE }]);
  const moduleDraft = (st: DemoState) =>
    st.drafts.find((d): d is KnowledgeDraft & { proposal: Extract<DraftProposal, { kind: "module_card_version" }> } => d.proposal.kind === "module_card_version")!;

  it("新版本的骨架是上一版，把被改的單元換成新單元卡；上一版的快照不動", () => {
    const st0 = closed();
    const d = moduleDraft(st0);
    const replacement = d.proposal.changes[0].unitCardId!;
    const before = getModuleCard(st0, "A4")!;
    const st = run([{ type: "draft/accept", draftId: d.id }], st0);
    const card = getModuleCard(st, "A4")!;
    expect(latestModuleCardVersion(card)).toBe(3);
    expect(moduleCardSkeleton(card)).toEqual(moduleCardSkeleton(before).map((id) => (id === "uc-a4-cloud-first" ? replacement : id)));
    expect(moduleCardSkeleton(card)).not.toContain("uc-a4-cloud-first");
    expect(moduleCardSkeleton(card, 2)).toEqual(moduleCardSkeleton(before, 2));
    expect(moduleCardSkeleton(card, 1)).toEqual(moduleCardSkeleton(before, 1));
  });

  it("新單元卡還在待審時，接受模組卡新版本會一起收進知識庫，骨架裡沒有懸空的 id", () => {
    const st0 = closed();
    const d = moduleDraft(st0);
    const replacement = d.proposal.changes[0].unitCardId!;
    expect(getUnitCard(st0, replacement)).toBeUndefined();
    const st = run([{ type: "draft/accept", draftId: d.id }], st0);
    expect(getUnitCard(st, replacement)).toMatchObject({ moduleId: "A4", title: "雲端流程上手（請款版）" });
    expect(st.drafts.some((x) => x.proposal.kind === "new_unit_card" && x.proposal.unitCard.id === replacement)).toBe(false);
    for (const id of moduleCardSkeleton(getModuleCard(st, "A4")!)) expect(getUnitCard(st, id), id).toBeDefined();
  });

  it("單元卡已先單獨收進知識庫時不會重複收進；之後再接受課程配方也沒問題", () => {
    const st0 = closed();
    const d = moduleDraft(st0);
    const unitDraft = st0.drafts.find((x) => x.proposal.kind === "new_unit_card" && x.proposal.unitCard.id === d.proposal.changes[0].unitCardId)!;
    const recipeDraft = st0.drafts.find((x) => x.proposal.kind === "new_course_recipe")!;
    const st = run([{ type: "draft/accept", draftId: unitDraft.id }, { type: "draft/accept", draftId: d.id }, { type: "draft/accept", draftId: recipeDraft.id }], st0);
    const id = d.proposal.changes[0].unitCardId!;
    expect(st.unitCards.filter((u) => u.id === id)).toHaveLength(1);
    expect(moduleCardSkeleton(getModuleCard(st, "A4")!)).toContain(id);
  });
});

describe("課程來源記錄模組卡版本", () => {
  const create = (moduleIds: ModuleId[], moduleVersions?: ModuleVersionPick): Extract<DemoAction, { type: "course/create" }> => ({
    type: "course/create",
    id: "c-v",
    projectId: "p-a-2026",
    title: "新課",
    moduleIds,
    moduleVersions,
    totalHours: 6,
    industryPackId: "ip-finance-approval",
  });

  it("沒指定版本就用最新版本；來源依模組順序記下每個模組與版本，加上產業素材包", () => {
    const st = run([create(["B1", "A4", "A1"])]);
    expect(getCourse(st, "c-v")!.source).toEqual({
      modules: [
        { moduleId: "A1", version: 2 },
        { moduleId: "A4", version: 2 },
        { moduleId: "B1", version: 1 },
      ],
      industryPackId: "ip-finance-approval",
    });
  });

  it("從舊版本出生的課程與從新版本出生的課程，起始藍圖看得出差別，來源也各記各的版本", () => {
    const oldSt = run([create(["A4"], { A4: 1 })]);
    const newSt = run([create(["A4"])]);
    expect(getCourse(oldSt, "c-v")!.source!.modules).toEqual([{ moduleId: "A4", version: 1 }]);
    expect(getCourse(newSt, "c-v")!.source!.modules).toEqual([{ moduleId: "A4", version: 2 }]);
    expect(unitTitles(oldSt, "c-v")).toEqual(["雲端流程上手", "表單觸發器", "逾期提醒"]);
    expect(unitTitles(newSt, "c-v")).toEqual(["雲端流程上手", "表單觸發器", "逾期提醒", "寄送前的安全網"]);
    expect(unitTitles(oldSt, "c-v")).not.toEqual(unitTitles(newSt, "c-v"));
    expect(getCourse(oldSt, "c-v")!.blueprintHistory[0].note).toBe("從模組卡「A4 雲端自動化」v1 複製出生");
    expect(getCourse(newSt, "c-v")!.blueprintHistory[0].note).toBe("從模組卡「A4 雲端自動化」v2 複製出生");
  });

  it("指定的版本不存在時退回最新版本", () => {
    expect(getCourse(run([create(["A4"], { A4: 9 })]), "c-v")!.source!.modules).toEqual([{ moduleId: "A4", version: 2 }]);
  });

  it("接受新版本後才開的課程，起始藍圖用新骨架；之前出生的課程不跟著變", () => {
    const st0 = run([create(["A4"])]);
    const closed = run([{ type: "course/close", courseId: "c-pa-pilot" }], st0);
    const draft = closed.drafts.find((d) => d.proposal.kind === "module_card_version")!;
    const accepted = run([{ type: "draft/accept", draftId: draft.id }], closed);
    expect(unitTitles(accepted, "c-v")).toEqual(unitTitles(st0, "c-v"));
    const later = run([{ ...create(["A4"]), id: "c-later" }], accepted);
    expect(getCourse(later, "c-later")!.source!.modules).toEqual([{ moduleId: "A4", version: 3 }]);
    expect(unitTitles(later, "c-later")).toContain("雲端流程上手（請款版）");
    expect(unitTitles(later, "c-later")).not.toContain("雲端流程上手");
  });

  it("沒選模組從零開始：來源是 null", () => {
    expect(getCourse(run([{ ...create([]), industryPackId: null }]), "c-v")!.source).toBeNull();
  });

  it("starterBlueprint 依指定版本取骨架", () => {
    const st = initialState();
    const bp = starterBlueprint({ title: "t", clientContext: st.projects[0].clientContext, moduleCards: [getModuleCard(st, "A4")!], moduleVersions: { A4: 1 }, unitCards: st.unitCards });
    expect(bp.days.flatMap((d) => d.slots.flatMap((s) => s.units)).map((u) => u.source?.id).filter(Boolean)).toEqual(moduleCardSkeleton(getModuleCard(st, "A4")!, 1));
  });
});
