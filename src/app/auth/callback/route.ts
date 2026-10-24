import { NextResponse, type NextRequest } from "next/server";
import { originFromHeaders } from "@/lib/auth/origin";
import { callbackError, safeNext } from "@/lib/auth/routes";
import { createSessionClient } from "@/lib/supabase/server";

/** Google 登入回來的地方：用 code 換 session（寫進 cookie），再回到原本要去的頁面。 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const origin = originFromHeaders(request.headers);
  const next = safeNext(searchParams.get("next"));

  const error = callbackError(searchParams);
  const code = searchParams.get("code");
  if (!error && code) {
    const supabase = await createSessionClient();
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (!exchangeError) return NextResponse.redirect(new URL(next, origin));
  }

  const login = new URL("/login", origin);
  login.searchParams.set("error", error ?? "oauth");
  if (next !== "/") login.searchParams.set("next", next);
  return NextResponse.redirect(login);
}
