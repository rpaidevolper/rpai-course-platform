"use client";

import { useLayoutEffect } from "react";
import { applyTheme, currentTheme, setTheme, THEME_STORAGE_KEY } from "@/lib/theme";

/**
 * 深淺色切換鈕（#118）。按鈕文字用 dark: variant 切換，render 時不必知道目前的模式，
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
      className={`text-xs font-bold text-body-muted underline underline-offset-2 hover:text-accent ${className}`}
    >
      <span className="dark:hidden">深色模式</span>
      <span className="hidden dark:inline">淺色模式</span>
    </button>
  );
}
