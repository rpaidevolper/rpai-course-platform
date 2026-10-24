"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { resetDemo, useArtifactSimulator } from "@/lib/mockup/store";

/**
 * demo 的全域執行環境（#48）：產檔模擬計時器與提示訊息。掛在根 layout 一次。
 */

type ToastItem = { id: number; message: string };
let toasts: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** 在畫面右下角顯示一則短訊息，幾秒後消失。給操作完成後的回饋用。 */
export function toast(message: string) {
  const id = nextId++;
  toasts = [...toasts, { id, message }];
  emit();
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    emit();
  }, 3200);
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const EMPTY: ToastItem[] = [];

export function DemoRuntime() {
  useArtifactSimulator();
  const items = useSyncExternalStore(subscribe, () => toasts, () => EMPTY);

  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-end gap-2">
      {items.map((t) => (
        <p key={t.id} className="rounded-md bg-navy px-4 py-2.5 text-sm font-bold text-white shadow-lg">
          {t.message}
        </p>
      ))}
    </div>
  );
}

/** 回到初始假資料。按兩次才生效，避免 demo 中誤按。 */
export function ResetDemoButton({ className = "" }: { className?: string }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(t);
  }, [armed]);

  return (
    <button
      type="button"
      onClick={() => {
        if (!armed) return setArmed(true);
        resetDemo();
        setArmed(false);
        toast("已重置 demo，回到初始假資料");
      }}
      className={`text-xs font-bold underline underline-offset-2 ${armed ? "text-danger" : "text-body-muted hover:text-navy"} ${className}`}
    >
      {armed ? "再按一次確認重置" : "重置 demo"}
    </button>
  );
}
