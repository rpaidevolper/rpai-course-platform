import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabasePublicEnv } from "./env";

/**
 * 帶講師 session 的 Supabase client，給 Server Component、Server Action 與 Route Handler 用。
 * 查詢以講師自己的身分執行，RLS 以工作區過濾。每個請求各建一個，不要共用。
 */
export async function createSessionClient() {
  // 先讀 cookie：頁面因此一律在請求時才渲染，build 時（CI 沒有任何環境變數）不會去連 Supabase
  const cookieStore = await cookies();
  const { url, anonKey } = supabasePublicEnv();
  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Server Component 不能寫 cookie；session 的更新由 src/proxy.ts 負責
        }
      },
    },
  });
}
