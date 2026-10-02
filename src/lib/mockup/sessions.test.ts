import { describe, expect, it } from "vitest";
import { COURSES, SESSIONS } from "./data";
import { getInstructor } from "./instructor";
import { getCourse, getSession, portalDay, portalView, readiness, readinessText, sessionDayCountMismatch } from "./logic";
import type { SessionDay } from "./types";

const day = (date: string, instructorId = "inst-lin"): SessionDay => ({
  startsAt: `${date}T09:00:00+08:00`,
  endsAt: `${date}T16:00:00+08:00`,
  venue: "訓練教室",
  instructorId,
});

const twoDayBlueprint = getCourse("c-gas-two-day")!.blueprint;

describe("場次天數必須等於藍圖天數", () => {
  it("天數相同時沒有問題", () => {
    expect(twoDayBlueprint.days).toHaveLength(2);
    expect(sessionDayCountMismatch({ days: [day("2026-10-20"), day("2026-10-27")] }, twoDayBlueprint)).toBeNull();
  });

  it("場次天數比藍圖少時回報兩邊的天數", () => {
    expect(sessionDayCountMismatch({ days: [day("2026-10-20")] }, twoDayBlueprint)).toEqual({
      sessionDays: 1,
      blueprintDays: 2,
    });
  });

  it("場次天數比藍圖多時回報兩邊的天數", () => {
    const days = [day("2026-10-20"), day("2026-10-27"), day("2026-11-03")];
    expect(sessionDayCountMismatch({ days }, twoDayBlueprint)).toEqual({ sessionDays: 3, blueprintDays: 2 });
  });
});

describe("場次 fixture", () => {
  it.each(SESSIONS)("場次 $id 的天數等於藍圖天數", (s) => {
    expect(sessionDayCountMismatch(s, getCourse(s.courseId)!.blueprint)).toBeNull();
  });

  it.each(SESSIONS)("場次 $id 每一天的授課講師都存在", (s) => {
    for (const d of s.days) expect(getInstructor(d.instructorId), d.instructorId).toBeDefined();
  });

  it("有一個多天場次，每天由不同講師授課", () => {
    const multi = SESSIONS.filter((s) => s.days.length > 1);
    expect(multi.length).toBeGreaterThan(0);
    expect(multi.some((s) => new Set(s.days.map((d) => d.instructorId)).size > 1)).toBe(true);
  });

  it("發布鎖定的產物都是可用版本（ready）", () => {
    for (const s of SESSIONS) {
      if (!s.publication) continue;
      const course = COURSES.find((c) => c.id === s.courseId)!;
      for (const id of s.publication.artifactIds) {
        expect(course.artifacts.find((a) => a.id === id)?.status, id).toBe("ready");
      }
    }
  });
});

describe("學員入口依日期選天", () => {
  // 第一天 10/20、第二天 10/27，中間隔一週（系列課也是這種形狀）
  const session = { days: [day("2026-10-20"), day("2026-10-27", "inst-chou")] };
  const at = (t: string) => portalDay(session, t);

  it("第一天之前顯示第一天", () => {
    expect(at("2026-10-05T12:00:00+08:00")).toBe(1);
    expect(at("2026-10-19T23:59:00+08:00")).toBe(1);
  });

  it("第一天當天，不論上課前、上課中或下課後，都是第一天", () => {
    expect(at("2026-10-20T07:00:00+08:00")).toBe(1);
    expect(at("2026-10-20T11:00:00+08:00")).toBe(1);
    expect(at("2026-10-20T21:00:00+08:00")).toBe(1);
  });

  it("兩天之間顯示下一個要上的那天", () => {
    expect(at("2026-10-21T00:00:00+08:00")).toBe(2);
    expect(at("2026-10-24T15:00:00+08:00")).toBe(2);
  });

  it("第二天當天是第二天，日期以台灣時間判斷（台灣過了午夜、UTC 還在前一天）", () => {
    expect(at("2026-10-27T00:30:00+08:00")).toBe(2);
    expect(at("2026-10-27T10:00:00+08:00")).toBe(2);
  });

  it("最後一天之後顯示最後一天", () => {
    expect(at("2026-10-28T09:00:00+08:00")).toBe(2);
    expect(at("2026-11-20T09:00:00+08:00")).toBe(2);
  });

  it("單天場次永遠是第一天", () => {
    const single = { days: [day("2026-10-15")] };
    expect(portalDay(single, "2026-10-01T09:00:00+08:00")).toBe(1);
    expect(portalDay(single, "2026-10-15T09:00:00+08:00")).toBe(1);
    expect(portalDay(single, "2026-10-30T09:00:00+08:00")).toBe(1);
  });
});

describe("多天場次的學員入口", () => {
  // s-gas-1020：第一天 10/20（林予晴）、第二天 10/27（周明遠），發布了兩天的簡報與學員手冊
  const ids = (now: string) => portalView("e1020", now)!.artifacts.map((a) => a.id);

  it("第一天之前就先看到第一天的簡報與整門課的學員手冊", () => {
    const view = portalView("e1020", "2026-10-08T10:00:00+08:00")!;
    expect(view.state).toBe("open");
    expect(view.day).toBe(1);
    expect(ids("2026-10-08T10:00:00+08:00")).toEqual(["a-gas-slides-d1-1", "a-gas-handbook-1"]);
  });

  it("第一天只看到第一天的簡報，不會看到第二天的", () => {
    expect(ids("2026-10-20T10:00:00+08:00")).toEqual(["a-gas-slides-d1-1", "a-gas-handbook-1"]);
  });

  it("兩天之間與第二天看到第二天的簡報，學員手冊一直都在", () => {
    expect(ids("2026-10-23T10:00:00+08:00")).toEqual(["a-gas-slides-d2-1", "a-gas-handbook-1"]);
    expect(ids("2026-10-27T10:00:00+08:00")).toEqual(["a-gas-slides-d2-1", "a-gas-handbook-1"]);
  });

  it("最後一天之後停在最後一天", () => {
    expect(portalView("e1020", "2026-11-10T10:00:00+08:00")!.day).toBe(2);
    expect(ids("2026-11-10T10:00:00+08:00")).toEqual(["a-gas-slides-d2-1", "a-gas-handbook-1"]);
  });

  it("列出每一天的日期與地點", () => {
    const view = portalView("e1020", "2026-10-20T10:00:00+08:00")!;
    expect(view.days).toEqual([
      { day: 1, startsAt: "2026-10-20T09:00:00+08:00", endsAt: "2026-10-20T16:00:00+08:00", venue: "E 公司新竹廠 2F 會議室" },
      { day: 2, startsAt: "2026-10-27T09:00:00+08:00", endsAt: "2026-10-27T16:00:00+08:00", venue: "E 公司新竹廠 2F 會議室" },
    ]);
  });
});

describe("多天場次的地點", () => {
  it("哪一天地點還沒定就列出哪一天", () => {
    const base = getSession("s-gas-1020")!;
    const session = { ...base, days: [base.days[0], { ...base.days[1], venue: null }] };
    const item = readiness(session).find((i) => i.kind === "venue_unset")!;
    expect(item).toEqual({ kind: "venue_unset", days: [2], totalDays: 2 });
    expect(readinessText(item)).toBe("第 2 天地點還沒定");
  });

  it("單天場次不標第幾天", () => {
    const item = readiness(getSession("s-ca-1105")!).find((i) => i.kind === "venue_unset")!;
    expect(readinessText(item)).toBe("地點還沒定");
  });

  it("每一天都有地點時不列", () => {
    expect(readiness(getSession("s-gas-1020")!).map((i) => i.kind)).not.toContain("venue_unset");
  });
});
