import { describe, expect, it } from "vitest";
import { DEFAULT_MODEL, MODEL_OPTIONS, ModelIdSchema } from "./models";

describe("ModelIdSchema", () => {
  it("接受清單內的每個模型", () => {
    for (const { id } of MODEL_OPTIONS) {
      expect(ModelIdSchema.parse(id)).toBe(id);
    }
  });

  it("拒絕清單外的模型", () => {
    expect(ModelIdSchema.safeParse("gpt-5").success).toBe(false);
    expect(ModelIdSchema.safeParse("claude-opus-5-20260101").success).toBe(false);
  });

  it("預設模型在清單內", () => {
    expect(ModelIdSchema.safeParse(DEFAULT_MODEL).success).toBe(true);
  });
});
