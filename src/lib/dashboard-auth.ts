import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/** 登入 cookie 的名字。proxy.ts 只看有沒有這個 cookie，真正的驗證在 session.ts。 */
export const DASHBOARD_COOKIE = "rpai_dashboard";
/** 登入後幾天內不用重登。cookie 的 maxAge 與簽章裡的到期時間都用這個值。 */
export const DASHBOARD_SESSION_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 兩個字串是否相同，比對時間不因內容而變。
 * 各自先算 SHA-256，長度就一樣了，timingSafeEqual 才能用。
 */
function sameText(a: string, b: string): boolean {
  const hash = (text: string) => createHash("sha256").update(text).digest();
  return timingSafeEqual(hash(a), hash(b));
}

/** 簽章：HMAC-SHA256(key=密碼, "rpai-dashboard:<到期時間毫秒>")，十六進位。換密碼後舊簽章就對不上。 */
function signature(password: string, expiresAt: number): string {
  return createHmac("sha256", password).update(`rpai-dashboard:${expiresAt}`).digest("hex");
}

/** 密碼對不對。password 或 expected 是空的一律不通過。 */
export function checkPassword(password: string, expected: string | undefined): boolean {
  if (!password || !expected) return false;
  return sameText(password, expected);
}

/** cookie 值：`<到期時間毫秒>.<簽章>`。 */
export function signDashboardSession(password: string, now: Date): string {
  const expiresAt = now.getTime() + DASHBOARD_SESSION_DAYS * DAY_MS;
  return `${expiresAt}.${signature(password, expiresAt)}`;
}

/** 格式對、還沒過期、簽章相符才是 true。 */
export function verifyDashboardSession(value: string | undefined, password: string | undefined, now: Date): boolean {
  if (!value || !password) return false;
  const match = /^(\d+)\.([0-9a-f]{64})$/.exec(value);
  if (!match) return false;
  const expiresAt = Number(match[1]);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= now.getTime()) return false;
  return sameText(match[2], signature(password, expiresAt));
}

/** 登入後要導去的路徑：只接受站內路徑（`/` 開頭），其他一律回 `/`。 */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/";
  // 反斜線與控制字元（例如 tab）也擋：瀏覽器會把 `/\evil.com`、`/<tab>/evil.com` 當成 `//evil.com`。
  for (const ch of next) {
    if (ch === "\\" || ch < " " || ch === "\x7f") return "/";
  }
  return next;
}
