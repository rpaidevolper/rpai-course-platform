"use client";

import { useActionState } from "react";
import { CopyButton } from "../../_components/copy-button";
import { Button, EMPHASIS, Field, TextInput } from "../../_components/ui";
import { createTokenAction, type CreateTokenState } from "./actions";

/** 產生權杖。明文只在產生後顯示這一次；離開或重新整理就看不到了，要再產生一組。 */
export function CreateTokenForm() {
  const [state, formAction, pending] = useActionState<CreateTokenState, FormData>(createTokenAction, {});

  return (
    <div className="space-y-4">
      <form action={formAction} className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1 basis-60">
          <Field label="標籤" hint="用來認出這組權杖，例如這台電腦的名稱。">
            <TextInput name="label" required maxLength={100} placeholder="例如：Eddy 的 MacBook" autoComplete="off" />
          </Field>
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "產生中…" : "產生權杖"}
        </Button>
      </form>

      {state.error && (
        <p role="alert" className="text-sm font-bold text-danger">
          {state.error}
        </p>
      )}

      {state.token && (
        <div role="status" className={`space-y-3 rounded-md bg-canvas p-4 ${EMPHASIS}`}>
          <p className="text-sm font-bold text-ink">
            「{state.label}」的權杖只會顯示這一次，請現在複製，貼到 plugin 的 api_token。
          </p>
          <code className="block break-all rounded-md bg-card p-3 text-sm text-ink">{state.token}</code>
          <CopyButton text={state.token} copiedText="已複製">
            複製權杖
          </CopyButton>
        </div>
      )}
    </div>
  );
}
