"use client";

import { useLayoutEffect } from "react";
import { applyTheme, currentTheme, setTheme, THEME_SCRIPT, THEME_STORAGE_KEY } from "@/lib/theme";

/**
 * 放在根 layout 的 <head>：伺服器輸出可執行的 script，在第一次繪製前設好 data-theme。
 * 瀏覽器這邊 render 成 text/plain，React 才不會在 dev 警告「render 出 script」；suppressHydrationWarning 吃掉 type 的差異。
 */
export function ThemeScript() {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }}
    />
  );
}

/**
 * 深淺色切換鈕（#118）。按鈕內容用 dark: variant 切換，render 時不必知道目前的模式，
 * 伺服器與瀏覽器輸出一樣，不會有 hydration 落差。
 */
export function ThemeToggle({ className = "" }: { className?: string }) {
  useLayoutEffect(() => {
    // dev 的 Strict Mode 重新掛載會清掉 inline script 設的 data-theme，這裡補回來；production 沒有作用
    applyTheme(THEME_STORAGE_KEY);
    // 沒選過的人，作業系統切換深淺色時跟著換
    const media = matchMedia("(prefers-color-scheme: dark)");
    const follow = () => applyTheme(THEME_STORAGE_KEY);
    media.addEventListener("change", follow);
    return () => media.removeEventListener("change", follow);
  }, []);

  return (
    <button
      type="button"
      onClick={() => setTheme(currentTheme() === "dark" ? "light" : "dark")}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-bold text-body hover:bg-layer hover:text-ink ${className}`}
    >
      <span className="inline-flex items-center gap-1.5 dark:hidden">
        <svg aria-hidden viewBox="0 0 24 24" className="size-4 fill-none stroke-current stroke-2">
          <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z" strokeLinejoin="round" />
        </svg>
        深色模式
      </span>
      <span className="hidden items-center gap-1.5 dark:inline-flex">
        <svg aria-hidden viewBox="0 0 24 24" className="size-4 fill-none stroke-current stroke-2" strokeLinecap="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
        </svg>
        淺色模式
      </span>
    </button>
  );
}
