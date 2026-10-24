import { describe, expect, it } from "vitest";
import { demoReducer } from "./actions";
import { importProposals, titleFromFileName } from "./import-script";
import { getRecipe, recipeUnitCards } from "./logic";
import { initialState } from "./state";
import { MODULES } from "./types";

describe("匯入過往講義的腳本化草稿", () => {
  it("標題是去掉副檔名的檔名", () => {
    expect(titleFromFileName("2025 行政 AI 工作坊.pptx")).toBe("2025 行政 AI 工作坊");
    expect(titleFromFileName("a.b.final.pdf")).toBe("a.b.final");
    expect(titleFromFileName("C:\\Users\\me\\講義.docx")).toBe("講義");
    expect(titleFromFileName("notes")).toBe("notes");
    expect(titleFromFileName(".md")).toBe(".md");
  });

  it.each(MODULES.map((m) => m.id))("模組 %s 產生一份課程配方草稿，和 2–3 份新單元卡草稿（都屬於該模組、各 60 分鐘）", (moduleId) => {
    const proposals = importProposals("講義.pdf", moduleId, "imp");
    const [recipe, ...units] = proposals;
    expect(recipe.kind).toBe("new_course_recipe");
    if (recipe.kind !== "new_course_recipe") return;
    expect(recipe.recipe).toMatchObject({ id: "imp", title: "講義" });
    expect(units.length).toBeGreaterThanOrEqual(2);
    expect(units.length).toBeLessThanOrEqual(3);
    const cards = units.flatMap((u) => (u.kind === "new_unit_card" ? [u.unitCard] : []));
    expect(cards).toHaveLength(units.length);
    expect(cards.every((u) => u.moduleId === moduleId && u.minutes === 60)).toBe(true);
    expect(recipe.unitCardIds).toEqual(cards.map((u) => u.id));
  });

  it("匯入後收進知識庫：配方與單元卡都收進來，草稿消失", () => {
    const proposals = importProposals("GAS 實戰.pptx", "A4", "rc-new");
    let st = demoReducer(initialState(), { type: "draft/import", id: "d-new", fileName: "GAS 實戰.pptx", proposals });
    expect(st.drafts.map((d) => d.id)).toEqual(proposals.map((_, i) => `d-new-${i + 1}`));
    st = demoReducer(st, { type: "draft/accept", draftId: "d-new-1" });
    const recipe = getRecipe(st, "rc-new")!;
    expect(recipe).toMatchObject({ title: "GAS 實戰", client: "匯入的講義", status: "delivered" });
    expect(recipe.unitIds).toEqual(proposals.slice(1).map((_, i) => `rc-new-u${i + 1}`));
    expect(recipeUnitCards(st, recipe).map((u) => u.moduleId)).toEqual(recipe.unitIds.map(() => "A4"));
    expect(st.drafts).toEqual([]);
  });
});
