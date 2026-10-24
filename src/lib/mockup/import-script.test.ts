import { describe, expect, it } from "vitest";
import { demoReducer } from "./actions";
import { importProposal, titleFromFileName } from "./import-script";
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

  it.each(MODULES.map((m) => m.id))("模組 %s 產生 2–3 張單元卡，都屬於該模組、各 60 分鐘", (moduleId) => {
    const p = importProposal("講義.pdf", moduleId);
    expect(p.kind).toBe("new_course_recipe");
    expect(p.recipe.title).toBe("講義");
    expect(p.unitCards.length).toBeGreaterThanOrEqual(2);
    expect(p.unitCards.length).toBeLessThanOrEqual(3);
    expect(p.unitCards.every((u) => u.moduleId === moduleId && u.minutes === 60)).toBe(true);
  });

  it("匯入後收進知識庫：配方與單元卡都收進來，草稿消失", () => {
    const proposal = importProposal("GAS 實戰.pptx", "A4");
    let st = demoReducer(initialState(), { type: "draft/import", id: "d-new", fileName: "GAS 實戰.pptx", proposal });
    st = demoReducer(st, { type: "draft/accept", draftId: "d-new", newId: "rc-new" });
    const recipe = getRecipe(st, "rc-new")!;
    expect(recipe).toMatchObject({ title: "GAS 實戰", client: "匯入的講義", status: "delivered" });
    expect(recipe.unitIds).toEqual(proposal.unitCards.map((_, i) => `rc-new-u${i + 1}`));
    expect(recipeUnitCards(st, recipe).map((u) => u.moduleId)).toEqual(proposal.unitCards.map(() => "A4"));
    expect(st.drafts.some((d) => d.id === "d-new")).toBe(false);
  });
});
