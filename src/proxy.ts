import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { needsLogin } from "@/lib/auth/routes";
import { supabasePublicEnv } from "@/lib/supabase/env";

/**
 * 每個頁面請求先更新 Supabase session（token 過期時換新、寫回 cookie），再做樂觀檢查：
 * 沒登入就導去登入頁。真正的授權在資料層（RLS、MCP store 的工作區條件），這裡只負責導頁。
 */
export async function proxy(request: NextRequest) {
  const { url, anonKey } = supabasePublicEnv();
  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        // 帶著新 session 的回應不能被 CDN 快取
        for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
      },
    },
  });

  // 一定要在產生回應前呼叫：它會驗證 JWT，必要時換新 token 並經由 setAll 寫回 cookie
  const { data } = await supabase.auth.getClaims();

  if (!data?.claims && needsLogin(request.nextUrl.pathname)) {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.search = "";
    login.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
    const redirect = NextResponse.redirect(login);
    // 換 token 失敗時 setAll 會清掉 cookie，導頁也要帶上
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  }

  return response;
}

export const config = {
  // API（/api/mcp 用權杖、/api/health 公開）、靜態檔與圖片不經過 proxy
  matcher: ["/((?!api/|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
