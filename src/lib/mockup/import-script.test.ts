import { describe, expect, it } from "vitest";
import { demoReducer } from "./actions";
import { importProposal, titleFromFileName } from "./import-script";
import { initialState } from "./state";
import { TOPICS } from "./types";

describe("匯入過往講義的腳本化草稿", () => {
  it("標題是去掉副檔名的檔名", () => {
    expect(titleFromFileName("2025 行政 AI 工作坊.pptx")).toBe("2025 行政 AI 工作坊");
    expect(titleFromFileName("a.b.final.pdf")).toBe("a.b.final");
    expect(titleFromFileName("C:\\Users\\me\\講義.docx")).toBe("講義");
    expect(titleFromFileName("notes")).toBe("notes");
    expect(titleFromFileName(".md")).toBe(".md");
  });

  it.each(TOPICS.map((t) => t.id))("主題 %s 產生 3–4 個單元的新框架", (topicId) => {
    const p = importProposal("講義.pdf", topicId);
    expect(p.kind).toBe("new_framework");
    expect(p.framework.topicId).toBe(topicId);
    expect(p.framework.title).toBe("講義");
    expect(p.framework.summary).toContain("講義");
    expect(p.framework.moduleTitles.length).toBeGreaterThanOrEqual(3);
    expect(p.framework.moduleTitles.length).toBeLessThanOrEqual(4);
  });

  it("匯入後收進知識庫，框架出現在該主題、v1 記下來源檔名", () => {
    let st = demoReducer(initialState(), {
      type: "draft/import",
      id: "d-new",
      fileName: "GAS 實戰.pptx",
      proposal: importProposal("GAS 實戰.pptx", "gas"),
    });
    st = demoReducer(st, { type: "draft/accept", draftId: "d-new", newId: "fw-new" });
    const fw = st.frameworks.find((f) => f.id === "fw-new");
    expect(fw?.topicId).toBe("gas");
    expect(fw?.title).toBe("GAS 實戰");
    expect(fw?.versions[0].note).toContain("GAS 實戰.pptx");
    expect(st.drafts.some((d) => d.id === "d-new")).toBe(false);
  });
});
