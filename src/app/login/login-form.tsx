"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";

const START: LoginState = {};

/** 登入表單。密碼不對時，錯誤訊息顯示在密碼欄下面。 */
export function LoginForm({ next, configured }: { next: string; configured: boolean }) {
  const [state, formAction, pending] = useActionState(login, START);

  return (
    <form action={formAction} className="mt-6 space-y-4">
      <input type="hidden" name="next" value={next} />
      <label className="block">
        <span className="block text-xs font-bold text-body-muted">密碼</span>
        <input
          name="password"
          type="password"
          required
          autoFocus
          autoComplete="current-password"
          disabled={!configured}
          aria-invalid={state.error ? true : undefined}
          aria-describedby={state.error ? "login-error" : undefined}
          className="mt-1 block w-full rounded-md bg-card px-3 py-2 text-sm text-ink ring-1 ring-inset ring-body-muted focus:ring-2 focus:ring-accent focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
        />
      </label>
      {state.error && (
        <p id="login-error" role="alert" className="text-sm font-bold text-danger">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={!configured || pending}
        className="w-full rounded-md bg-accent px-4 py-2.5 text-sm font-bold text-on-accent hover:bg-accent-press disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "登入中…" : "登入"}
      </button>
    </form>
  );
}
