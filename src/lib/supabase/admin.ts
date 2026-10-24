import { createClient } from "@supabase/supabase-js";

/**
 * 服務端專用的 Supabase client（service role，繞過 RLS）。
 * 只給 MCP、健康檢查這類沒有講師 session 的路徑用，查詢時要自己加上工作區條件；
 * 講師的頁面一律走 server.ts 的 createSessionClient。
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("缺少 NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}
