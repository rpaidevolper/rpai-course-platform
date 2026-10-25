import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** 上傳頁連結的有效時間：2 小時，跟 Storage 的 signed upload URL 一樣長。 */
export const UPLOAD_TOKEN_TTL_SECONDS = 2 * 60 * 60;

/**
 * 產生一次性上傳權杖。明文只回給呼叫端（放進上傳頁網址）；
 * meta 只存 sha256 與到期時間，寫進 artifacts.meta，資料庫裡找不到明文。
 */
export function createUploadToken(now: Date): {
  token: string;
  meta: { upload_token_hash: string; upload_expires_at: string };
} {
  const token = randomBytes(32).toString("base64url");
  return {
    token,
    meta: {
      upload_token_hash: sha256Hex(token),
      upload_expires_at: new Date(now.getTime() + UPLOAD_TOKEN_TTL_SECONDS * 1000).toISOString(),
    },
  };
}

/**
 * 權杖的 sha256 與 meta.upload_token_hash 相符、而且還沒過期才是 true。
 * meta 缺欄位或型別不對一律 false。
 */
export function verifyUploadToken(
  token: string | null | undefined,
  meta: Record<string, unknown> | null | undefined,
  now: Date,
): boolean {
  if (typeof token !== "string" || token === "") return false;
  if (typeof meta !== "object" || meta === null) return false;

  const storedHash = meta.upload_token_hash;
  const expiresAt = meta.upload_expires_at;
  if (typeof storedHash !== "string" || typeof expiresAt !== "string") return false;

  const expiresMs = Date.parse(expiresAt);
  if (Number.isNaN(expiresMs) || now.getTime() >= expiresMs) return false;

  const actual = Buffer.from(sha256Hex(token));
  const expected = Buffer.from(storedHash);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/**
 * 平台網址：PLATFORM_BASE_URL 優先；沒設定就用 Vercel 的正式網域；都沒有時用本機。
 * 結尾的 / 會去掉，組網址時才不會出現 //。
 */
export function platformBaseUrl(env: Record<string, string | undefined>): string {
  const explicit = env.PLATFORM_BASE_URL?.trim();
  const vercel = env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  const base = explicit || (vercel ? `https://${vercel}` : "http://localhost:3000");
  return base.replace(/\/+$/, "");
}

/** 講師在瀏覽器上傳的連結：`${baseUrl}/u/${artifactId}?t=權杖`。 */
export function uploadPageUrl(baseUrl: string, artifactId: string, token: string): string {
  return `${baseUrl}/u/${artifactId}?t=${encodeURIComponent(token)}`;
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
