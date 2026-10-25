import { describe, expect, it } from "vitest";
import { sanitizeRecipe } from "./sanitize.ts";

describe("sanitizeRecipe", () => {
  it("modules 寫成一串文字時也拆得開，標題照樣是中性名稱", () => {
    const result = sanitizeRecipe({
      fm: { id: "202405_虛構精密_AI週報實戰", client: "虛構精密工業", industry: "製造", hours: 6, modules: "A1、B2, A9" },
      body: "",
      id: "202405_虛構精密_AI週報實戰",
    });
    expect(result.modules).toEqual(["A1", "B2"]);
    expect(result.title).toBe("製造・A1、B2・一日");
    expect(result.frontmatter).not.toHaveProperty("client");
    expect(result.frontmatter).not.toHaveProperty("id");
  });
});
