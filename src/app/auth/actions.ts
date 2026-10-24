"use server";

import { redirect } from "next/navigation";
import { requestOrigin } from "@/lib/auth/origin";
import { safeNext, type LoginError } from "@/lib/auth/routes";
import { isLocalSupabaseUrl } from "@/lib/supabase/local";
import { createSessionClient } from "@/lib/supabase/server";

function loginPath(error: LoginError, next: string): string {
  const params = new URLSearchParams({ error });
  if (next !== "/") params.set("next", next);
  return `/login?${params}`;
}

/**
 * 講師用 Google 登入（待決-2）。Supabase 先把人帶去 Google，回來時打 /auth/callback 換 session。
 * 回呼網址要在 Supabase 的 Redirect URLs 白名單裡（本機見 supabase/config.toml，production 見 docs/runbook.md）。
 */
export async function signInWithGoogle(formData: FormData) {
  const next = safeNext(formData.get("next"));
  const callback = new URL("/auth/callback", await requestOrigin());
  if (next !== "/") callback.searchParams.set("next", next);

  const supabase = await createSessionClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: callback.toString(), queryParams: { prompt: "select_account" } },
  });
  if (error || !data.url) redirect(loginPath("oauth", next));
  redirect(data.url);
}

/** 本機開發用的密碼登入：只有本機 Supabase 開放，帳號由 `pnpm member:add --password` 建立。 */
export async function signInWithDevPassword(formData: FormData) {
  const next = safeNext(formData.get("next"));
  if (!isLocalSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL)) redirect(loginPath("oauth", next));

  const supabase = await createSessionClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  });
  if (error) redirect(loginPath("password", next));
  redirect(next);
}

export async function signOut() {
  const supabase = await createSessionClient();
  await supabase.auth.signOut();
  redirect("/login");
}
