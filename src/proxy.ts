import { NextResponse, type NextRequest } from "next/server";
import { DASHBOARD_COOKIE } from "@/lib/dashboard-auth";

/**
 * 樂觀檢查：沒有登入 cookie 就先導去登入頁。cookie 對不對由頁面（(dashboard)/session.ts）驗證。
 * 不攔：/login、設計稿（/demo）、API、/u/（上傳頁，連結本身就是授權）與靜態檔。
 */
export function proxy(request: NextRequest) {
  if (request.cookies.has(DASHBOARD_COOKIE)) return NextResponse.next();

  const login = new URL("/login", request.url);
  login.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!login|demo|api|u/|_next|favicon\\.ico).*)"],
};
