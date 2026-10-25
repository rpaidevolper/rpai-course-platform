"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import { Button, CARD, Field } from "../../_components/ui";
import { finishUpload, startUpload } from "./actions";

type Phase = "idle" | "uploading" | "done";

const NETWORK_FAILED = "上傳失敗，請再試一次。";

/**
 * 上傳表單。副檔名不對先擋在畫面上；通過後依序：拿上傳網址、PUT 到 Storage、請平台確認收到檔案。
 * 成功後按鈕停用，連結之後也會失效。
 */
export function UploadForm({ artifactId, token, extension }: { artifactId: string; token: string; extension: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);

  const wrongType = (name: string) => !name.toLowerCase().endsWith(extension);
  const wrongTypeMessage = `要上傳 ${extension} 檔。`;

  function choose(event: ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0] ?? null;
    setFile(picked);
    setError(picked !== null && wrongType(picked.name) ? wrongTypeMessage : null);
  }

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (file === null || phase !== "idle") return;
    if (wrongType(file.name)) {
      setError(wrongTypeMessage);
      return;
    }

    const fail = (message: string) => {
      setError(message);
      setPhase("idle");
    };
    setPhase("uploading");
    setError(null);
    try {
      const started = await startUpload(artifactId, token);
      if (!started.ok) return fail(started.error);

      const put = await fetch(started.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": started.contentType },
        body: file,
      });
      if (!put.ok) return fail(NETWORK_FAILED);

      const finished = await finishUpload(artifactId, token);
      if (!finished.ok) return fail(finished.error);
      setPhase("done");
    } catch {
      fail(NETWORK_FAILED);
    }
  }

  const buttonText = phase === "uploading" ? "上傳中…" : phase === "done" ? "已上傳" : "上傳";

  return (
    <form onSubmit={upload} className={`${CARD} space-y-4 p-5`}>
      <Field label={`選擇 ${extension} 檔`}>
        <input
          type="file"
          accept={extension}
          onChange={choose}
          disabled={phase !== "idle"}
          className="mt-1 block w-full text-sm text-ink file:mr-3 file:rounded-md file:border-0 file:bg-accent-tint file:px-3 file:py-2 file:text-sm file:font-bold file:text-ink disabled:opacity-60"
        />
      </Field>
      {error && (
        <p role="alert" className="text-sm font-bold text-danger">
          {error}
        </p>
      )}
      {phase === "done" && (
        <p role="status" className="text-sm font-bold text-success">
          上傳完成，平台已經記下這份產物。可以關掉這個頁面。
        </p>
      )}
      <Button type="submit" disabled={file === null || wrongType(file.name) || phase !== "idle"}>
        {buttonText}
      </Button>
    </form>
  );
}
