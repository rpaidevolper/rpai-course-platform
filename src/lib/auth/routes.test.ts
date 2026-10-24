import { describe, expect, it } from "vitest";
import { callbackError, needsLogin, safeNext } from "./routes";

describe("needsLogin", () => {
  it("講師頁與設計稿都要登入", () => {
    for (const path of ["/", "/settings", "/no-workspace", "/demo", "/demo/projects/p1", "/sessions/x", "/loginx"]) {
      expect(needsLogin(path), path).toBe(true);
    }
  });

  it("登入頁、登入回呼與學員入口不用登入", () => {
    for (const path of ["/login", "/auth/callback", "/s/ABCD-1234"]) {
      expect(needsLogin(path), path).toBe(false);
    }
  });
});

describe("safeNext", () => {
  it("站內路徑照用，保留 query", () => {
    expect(safeNext("/settings")).toBe("/settings");
    expect(safeNext("/demo/projects?tab=1")).toBe("/demo/projects?tab=1");
  });

  it("站外網址、protocol-relative 與非字串一律回首頁", () => {
    for (const next of ["https://evil.example", "//evil.example", "/\\evil.example", "settings", "", null, undefined]) {
      expect(safeNext(next), String(next)).toBe("/");
    }
  });
});

describe("callbackError", () => {
  it("公開註冊關閉時，沒被加入的帳號看到「還沒被加進後台」", () => {
    const params = new URLSearchParams({
      error: "access_denied",
      error_code: "signup_disabled",
      error_description: "Signups not allowed for this instance",
    });
    expect(callbackError(params)).toBe("not_invited");
  });

  it("其他 OAuth 錯誤是一般的登入失敗；沒有錯誤回 null", () => {
    expect(callbackError(new URLSearchParams({ error: "server_error" }))).toBe("oauth");
    expect(callbackError(new URLSearchParams({ code: "abc" }))).toBeNull();
  });
});
