/**
 * 是不是本機 Supabase（pnpm db:start 起的 127.0.0.1:54321）。
 * 本機開發用的密碼登入、`member:add --password` 都只在本機開放；production 的網址一定不是本機。
 * scripts/member.ts 直接用 Node 執行會 import 這個檔，所以不能用 `@/` import。
 */
export function isLocalSupabaseUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const { hostname } = new URL(url);
    return hostname === "127.0.0.1" || hostname === "localhost";
  } catch {
    return false;
  }
}
