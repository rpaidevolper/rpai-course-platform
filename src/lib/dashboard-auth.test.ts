import { describe, expect, it } from "vitest";
import {
  checkPassword,
  DASHBOARD_SESSION_DAYS,
  safeNextPath,
  signDashboardSession,
  verifyDashboardSession,
} from "./dashboard-auth";

const PASSWORD = "team-password";
const NOW = new Date("2026-10-01T00:00:00Z");
const DAY_MS = 24 * 60 * 60 * 1000;
/** NOW 之後的第幾天（可以是小數）。 */
const daysLater = (days: number) => new Date(NOW.getTime() + days * DAY_MS);

describe("登入 cookie", () => {
  const cookie = signDashboardSession(PASSWORD, NOW);

  it("30 天內通過", () => {
    expect(verifyDashboardSession(cookie, PASSWORD, NOW)).toBe(true);
    expect(verifyDashboardSession(cookie, PASSWORD, daysLater(DASHBOARD_SESSION_DAYS - 1))).toBe(true);
  });

  it("過了 30 天就不通過", () => {
    expect(verifyDashboardSession(cookie, PASSWORD, daysLater(DASHBOARD_SESSION_DAYS))).toBe(false);
    expect(verifyDashboardSession(cookie, PASSWORD, daysLater(DASHBOARD_SESSION_DAYS + 1))).toBe(false);
  });

  it("密碼錯、被改過、格式不對，或沒有 cookie、密碼是空的，都不通過", () => {
    const [expiresAt, sig] = cookie.split(".");
    const lastChar = sig.at(-1);
    const flipped = `${sig.slice(0, -1)}${lastChar === "0" ? "1" : "0"}`;
    const laterExpiry = `${Number(expiresAt) + DAY_MS}.${sig}`;

    expect(verifyDashboardSession(cookie, "wrong-password", NOW)).toBe(false);
    expect(verifyDashboardSession(`${expiresAt}.${flipped}`, PASSWORD, NOW)).toBe(false);
    expect(verifyDashboardSession(laterExpiry, PASSWORD, NOW)).toBe(false);
    for (const malformed of ["", "garbage", expiresAt, `${expiresAt}.${sig.toUpperCase()}`, `${expiresAt}.${sig}00`]) {
      expect(verifyDashboardSession(malformed, PASSWORD, NOW)).toBe(false);
    }
    expect(verifyDashboardSession(undefined, PASSWORD, NOW)).toBe(false);
    expect(verifyDashboardSession(cookie, "", NOW)).toBe(false);
    expect(verifyDashboardSession(cookie, undefined, NOW)).toBe(false);
  });

  it("換了密碼後，舊的 cookie 失效", () => {
    expect(verifyDashboardSession(cookie, "new-password", NOW)).toBe(false);
    expect(verifyDashboardSession(signDashboardSession("new-password", NOW), "new-password", NOW)).toBe(true);
  });
});

describe("checkPassword", () => {
  it("只有完全相同的密碼才通過", () => {
    expect(checkPassword(PASSWORD, PASSWORD)).toBe(true);
    expect(checkPassword("team-passwor", PASSWORD)).toBe(false);
    expect(checkPassword("TEAM-PASSWORD", PASSWORD)).toBe(false);
    expect(checkPassword(`${PASSWORD} `, PASSWORD)).toBe(false);
  });

  it("輸入是空的，或沒設定密碼，都不通過", () => {
    expect(checkPassword("", PASSWORD)).toBe(false);
    expect(checkPassword("", "")).toBe(false);
    expect(checkPassword(PASSWORD, undefined)).toBe(false);
    expect(checkPassword(PASSWORD, "")).toBe(false);
  });
});

describe("safeNextPath", () => {
  it("正常的站內路徑原樣回傳", () => {
    expect(safeNextPath("/")).toBe("/");
    expect(safeNextPath("/demo/courses/c1?tab=2")).toBe("/demo/courses/c1?tab=2");
  });

  it("外站、協定相對、反斜線與控制字元都回到 /", () => {
    for (const unsafe of [
      "//evil.com",
      "https://evil.com",
      "/\\evil.com",
      "\\\\evil.com",
      "/\t/evil.com",
      "/\n/evil.com",
      "javascript:alert(1)",
      "evil.com",
    ]) {
      expect(safeNextPath(unsafe)).toBe("/");
    }
  });

  it("沒有值時回到 /", () => {
    expect(safeNextPath(null)).toBe("/");
    expect(safeNextPath(undefined)).toBe("/");
    expect(safeNextPath("")).toBe("/");
  });
});
