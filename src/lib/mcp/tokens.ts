import { createHash, randomBytes } from "node:crypto";

/** 權杖固定前綴，讓講師一眼看出這是本平台的權杖，也方便 secret scanning。 */
export const TOKEN_PREFIX = "rcp_";

/** 產生一組新權杖。明文只在這裡出現一次，資料庫只存 hash。 */
export function generateToken(): { token: string; hash: string; prefix: string } {
  const token = TOKEN_PREFIX + randomBytes(32).toString("base64url");
  return { token, hash: hashToken(token), prefix: token.slice(0, TOKEN_PREFIX.length + 6) };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function looksLikeToken(value: string | undefined): value is string {
  return typeof value === "string" && value.startsWith(TOKEN_PREFIX) && value.length > 20;
}
