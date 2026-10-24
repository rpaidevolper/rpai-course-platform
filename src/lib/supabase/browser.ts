import { createBrowserClient } from "@supabase/ssr";

/**
 * 瀏覽器端帶講師 session 的 Supabase client（session 存在 cookie，和伺服器端共用）。
 * NEXT_PUBLIC_* 在 build 時寫進 bundle，所以這裡直接讀 process.env，不經過 supabasePublicEnv。
 */
export function createBrowserSessionClient() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}
