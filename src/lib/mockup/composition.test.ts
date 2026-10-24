import { describe, expect, it } from "vitest";
import { compositionWarnings, compositionWarningText } from "./composition";

describe("compositionWarnings 組課提醒", () => {
  it("6H 以下選 2 個 A 加 1 個 B：不提醒", () => {
    expect(compositionWarnings({ moduleIds: ["A1", "A2", "B1"], totalHours: 6 })).toEqual([]);
  });

  it("6H 以下選 3 個 A：提醒 A 太多", () => {
    expect(compositionWarnings({ moduleIds: ["A1", "A2", "A3", "B1"], totalHours: 6 })).toEqual([{ kind: "too_many_a", aCount: 3, totalHours: 6 }]);
    expect(compositionWarnings({ moduleIds: ["A1", "A2", "A3", "B1"], totalHours: 3 })).toHaveLength(1);
  });

  it("超過 6H 時選 3 個 A 不提醒（邊界：6H 以下含 6H）", () => {
    expect(compositionWarnings({ moduleIds: ["A1", "A2", "A3", "B1"], totalHours: 7 })).toEqual([]);
    expect(compositionWarnings({ moduleIds: ["A1", "A2", "A3", "B1"], totalHours: 12 })).toEqual([]);
  });

  it("沒有選 B：提醒", () => {
    expect(compositionWarnings({ moduleIds: ["A1"], totalHours: 6 })).toEqual([{ kind: "no_b" }]);
    expect(compositionWarnings({ moduleIds: [], totalHours: 12 })).toEqual([{ kind: "no_b" }]);
  });

  it("兩種情況同時成立：兩則都回，順序固定（沒有 B 在前）", () => {
    expect(compositionWarnings({ moduleIds: ["A1", "A2", "A3"], totalHours: 6 }).map((w) => w.kind)).toEqual(["no_b", "too_many_a"]);
  });

  it("重複的模組只算一次", () => {
    expect(compositionWarnings({ moduleIds: ["A1", "A1", "A2", "B1"], totalHours: 6 })).toEqual([]);
  });

  it("提醒文字講得出原因與數字", () => {
    expect(compositionWarningText({ kind: "no_b" })).toContain("B");
    expect(compositionWarningText({ kind: "too_many_a", aCount: 3, totalHours: 6 })).toMatch(/3.*A.*6/);
  });
});
