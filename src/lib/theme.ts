/**
 * 深淺色模式（#118）。選擇只存在這個瀏覽器；沒選過就跟作業系統。
 * 色碼在 src/app/globals.css：預設是淺色 N5，<html data-theme="dark"> 時換成深色 D1。
 */
export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "rpai-theme";

/**
 * 依存下來的選擇（沒有就看作業系統）設定 <html data-theme>。
 * 會被序列化成 THEME_SCRIPT，只能用參數與瀏覽器全域，不能引用這個模組的其他東西。
 */
export function applyTheme(storageKey: string): void {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(storageKey);
  } catch {
    // 儲存空間被封鎖時當作沒選過
  }
  const dark = stored === "dark" || (stored !== "light" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

/** 放在 <head> 的 inline script：在第一次繪製前同步執行，深色模式的人不會先閃一下淺色。 */
export const THEME_SCRIPT = `(${applyTheme.toString()})(${JSON.stringify(THEME_STORAGE_KEY)})`;

export function currentTheme(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

/** 講師或學員按了切換鈕：立刻換色並記住，之後不再跟作業系統。 */
export function setTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // 存不了就只在這一頁有效
  }
}
