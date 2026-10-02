"use client";

import { useEffect, useRef, type FormEvent, type ReactNode } from "react";
import { Button } from "./ui";

/**
 * 對話框（#48）。用原生 <dialog>：焦點鎖定、Esc 關閉都由瀏覽器處理。
 * 有 onSubmit 時整個內容是一個 form，按 Enter 會送出；送出後由呼叫端決定要不要關。
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  submitLabel,
  onSubmit,
  submitDisabled = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  /** 沒給就只有「關閉」按鈕 */
  submitLabel?: string;
  onSubmit?: () => void;
  submitDisabled?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!submitDisabled) onSubmit?.();
  };

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        // 點背景關閉
        if (e.target === ref.current) onClose();
      }}
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-lg bg-white p-0 text-body shadow-[0_12px_48px_rgba(1,20,85,0.18)] backdrop:bg-navy/40"
    >
      <form onSubmit={handleSubmit} className="p-6">
        <h2 className="text-lg font-bold text-navy">{title}</h2>
        {description && <div className="mt-1.5 text-sm">{description}</div>}
        {children && <div className="mt-5 space-y-4">{children}</div>}
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            {submitLabel ? "取消" : "關閉"}
          </Button>
          {submitLabel && (
            <Button type="submit" disabled={submitDisabled}>
              {submitLabel}
            </Button>
          )}
        </div>
      </form>
    </dialog>
  );
}
