import { describe, expect, it } from "vitest";
import { dayTimeText, formatDate, sessionDateRange } from "./logic";

describe("日期顯示（伺服器與瀏覽器要一字不差，否則 hydration mismatch）", () => {
  it("formatDate 固定是「月日 星期」，中間一個半形空白", () => {
    expect(formatDate("2026-10-15T01:00:00Z")).toBe("10月15日 週四");
  });

  it("以台北時間算日期，不看執行環境的時區", () => {
    // UTC 10/14 16:30 是台北 10/15 00:30
    expect(formatDate("2026-10-14T16:30:00Z")).toBe("10月15日 週四");
  });

  it("多天場次與一天的時間沿用同一格式", () => {
    const days = [
      { startsAt: "2026-10-20T01:00:00Z", endsAt: "2026-10-20T08:00:00Z" },
      { startsAt: "2026-10-27T01:00:00Z", endsAt: "2026-10-27T08:00:00Z" },
    ];
    expect(sessionDateRange({ days } as Parameters<typeof sessionDateRange>[0])).toBe("10月20日 週二–10月27日 週二");
    expect(dayTimeText(days[0])).toBe("10月20日 週二 09:00–16:00");
  });
});
