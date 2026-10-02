"use client";

import { useState } from "react";

type Status = "idle" | "copied" | "failed";

/** 把一段文字複製到剪貼簿；結果用 aria-live 念給螢幕閱讀器。 */
export function CopyButton({ text, children }: { text: string; children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>("idle");

  async function copy() {
    try {
      if (!navigator.clipboard) throw new Error("clipboard unavailable");
      await navigator.clipboard.writeText(text);
      setStatus("copied");
    } catch {
      setStatus("failed");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={copy}
        className="inline-flex items-center rounded-md bg-navy px-4 py-2 text-sm font-bold text-white hover:bg-navy-press"
      >
        {children}
      </button>
      <span aria-live="polite" className="text-xs font-bold">
        {status === "copied" && <span className="text-success">已複製，可以直接貼進信件</span>}
        {status === "failed" && <span className="text-danger">瀏覽器不讓複製，請手動選取下面的文字</span>}
      </span>
    </div>
  );
}
