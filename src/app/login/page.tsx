import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isLoginError, LOGIN_ERRORS, safeNext } from "@/lib/auth/routes";
import { getSignedInUser } from "@/lib/auth/session";
import { isLocalSupabaseUrl } from "@/lib/supabase/local";
import { AuthShell } from "../_components/auth-shell";
import { Button, Field, TextInput } from "../_components/ui";
import { signInWithDevPassword, signInWithGoogle } from "../auth/actions";

export const metadata: Metadata = { title: "登入" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = safeNext(params.next);
  if (await getSignedInUser()) redirect(next);

  const error = isLoginError(params.error) ? LOGIN_ERRORS[params.error] : null;
  const devLogin = isLocalSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);

  return (
    <AuthShell title="登入講師後台">
      {error && (
        <p role="alert" className="rounded-md bg-danger-tint px-3 py-2 font-bold text-danger">
          {error}
        </p>
      )}
      <form action={signInWithGoogle}>
        <input type="hidden" name="next" value={next} />
        <Button type="submit">用 Google 帳號登入</Button>
      </form>
      <p className="text-body-muted">只有被加進工作區的講師能登入。還沒被加入的話，請把你的 Google 帳號 email 給管理者。</p>

      {devLogin && (
        <details className="border-t-2 border-layer pt-4">
          <summary className="cursor-pointer font-bold text-ink">本機開發用：email ＋ 密碼</summary>
          <p className="mt-2 text-xs text-body-muted">
            只在連本機 Supabase 時出現。帳號用 <code>pnpm member:add --email … --name … --password …</code> 建立。
          </p>
          <form action={signInWithDevPassword} className="mt-3 space-y-3">
            <input type="hidden" name="next" value={next} />
            <Field label="Email">
              <TextInput type="email" name="email" required autoComplete="username" />
            </Field>
            <Field label="密碼">
              <TextInput type="password" name="password" required autoComplete="current-password" />
            </Field>
            <Button type="submit" variant="secondary">
              用密碼登入
            </Button>
          </form>
        </details>
      )}
    </AuthShell>
  );
}
