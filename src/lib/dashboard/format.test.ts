import { describe, expect, it } from "vitest";
import { formatDateTime } from "./format";

describe("formatDateTime", () => {
  it("用台北時間：UTC 00:00 是台北上午 8 點", () => {
    const text = formatDateTime("2026-10-25T00:00:00.000Z");
    expect(text).toContain("2026");
    expect(text).toMatch(/8:00/);
  });
});
