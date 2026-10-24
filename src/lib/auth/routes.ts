// 登入流程裡的路由判斷：哪些路徑要登入、登入後可以回到哪裡、登入失敗怎麼跟講師說。純函式，可單測。

/**
 * 不用登入就能打開的路徑。其餘頁面（包括 /demo 設計稿）沒登入一律導去登入頁。
 * /api/* 不經過 proxy：/api/mcp 用權杖驗證，/api/health 公開。
 * /s/ 是之後的學員入口，唯一的匿名路徑（#78）。
 */
const PUBLIC_PREFIXES = ["/login", "/auth/", "/s/"];

export function needsLogin(pathname: string): boolean {
  return !PUBLIC_PREFIXES.some((prefix) =>
    prefix.endsWith("/") ? pathname.startsWith(prefix) : pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/** 登入後要回去的頁面。只接受站內路徑，避免被拿來導去別的網站（open redirect）。 */
export function safeNext(next: unknown): string {
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return "/";
  }
  return next;
}

export const LOGIN_ERRORS = {
  not_invited: "這個帳號還沒被加進後台。請把你的 Google 帳號 email 給管理者，加入後再登入一次。",
  oauth: "登入沒有完成，請再試一次。",
  password: "email 或密碼不對。",
} as const;

export type LoginError = keyof typeof LOGIN_ERRORS;

export function isLoginError(value: unknown): value is LoginError {
  return typeof value === "string" && value in LOGIN_ERRORS;
}

/**
 * Supabase 把 OAuth 的失敗帶在回呼網址的 query（error、error_code、error_description）。
 * 公開註冊是關的，所以還沒被 member:add 建過帳號的 Google 帳號會收到 signup_disabled。
 */
export function callbackError(params: URLSearchParams): LoginError | null {
  if (params.get("error_code") === "signup_disabled") return "not_invited";
  if (params.has("error") || params.has("error_code")) return "oauth";
  return null;
}
