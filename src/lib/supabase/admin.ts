import { createClient } from "@supabase/supabase-js";

/**
 * 服務端專用的 Supabase client（service role，繞過 RLS）。
 * 只能在 server 端的背景工作用（例如產物生成完寫回 artifacts），
 * 講師的請求要走帶使用者 session 的 client，那部分等 @supabase/ssr 接上再加。
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("缺少 NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}
