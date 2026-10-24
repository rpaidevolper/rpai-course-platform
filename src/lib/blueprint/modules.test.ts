import { describe, expect, it } from "vitest";
import { getModule, MODULE_IDS, MODULES, moduleLabel } from "./modules";
import { UnitSchema } from "./schema";

describe("模組目錄", () => {
  it("藍圖單元的 module 欄位吃的就是目錄裡的模組，順序一致", () => {
    expect([...UnitSchema.shape.module.options]).toEqual(MODULES.map((m) => m.id));
    expect([...MODULE_IDS]).toEqual(MODULES.map((m) => m.id));
  });
  it("A1–A5 是環境、B1–B4 是方法", () => {
    expect(MODULES.filter((m) => m.kind === "A").map((m) => m.id)).toEqual(["A1", "A2", "A3", "A4", "A5"]);
    expect(MODULES.filter((m) => m.kind === "B").map((m) => m.id)).toEqual(["B1", "B2", "B3", "B4"]);
  });
  it("顯示名稱是代號加名稱", () => {
    expect(getModule("A1").kind).toBe("A");
    expect(moduleLabel("A1")).toBe("A1 通用生成 AI");
  });
});
