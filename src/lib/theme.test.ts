import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setTheme, THEME_SCRIPT, THEME_STORAGE_KEY } from "./theme";

let storage: Map<string, string>;
let prefersDark: boolean;
let blocked: boolean;
const html = { dataset: {} as Record<string, string> };

beforeEach(() => {
  storage = new Map();
  prefersDark = false;
  blocked = false;
  html.dataset = {};
  const guard = () => {
    if (blocked) throw new DOMException("blocked", "SecurityError");
  };
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => (guard(), storage.get(k) ?? null),
    setItem: (k: string, v: string) => (guard(), storage.set(k, v)),
  });
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: q === "(prefers-color-scheme: dark)" && prefersDark }));
  vi.stubGlobal("document", { documentElement: html });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** 跟瀏覽器一樣，把 inline script 當獨立的程式碼執行，確認序列化後還能動。 */
function runScript() {
  new Function(THEME_SCRIPT)();
  return html.dataset.theme;
}

describe("THEME_SCRIPT", () => {
  it("沒選過：跟作業系統", () => {
    expect(runScript()).toBe("light");
    prefersDark = true;
    expect(runScript()).toBe("dark");
  });

  it("選過就以選擇為準，不管作業系統", () => {
    storage.set(THEME_STORAGE_KEY, "light");
    prefersDark = true;
    expect(runScript()).toBe("light");
    storage.set(THEME_STORAGE_KEY, "dark");
    prefersDark = false;
    expect(runScript()).toBe("dark");
  });

  it("存的值看不懂：當作沒選過", () => {
    storage.set(THEME_STORAGE_KEY, "sepia");
    prefersDark = true;
    expect(runScript()).toBe("dark");
  });

  it("儲存空間被封鎖：當作沒選過，不丟錯", () => {
    blocked = true;
    prefersDark = true;
    expect(runScript()).toBe("dark");
  });
});

describe("setTheme", () => {
  it("立刻換色並記住，下次載入沿用", () => {
    prefersDark = true;
    setTheme("light");
    expect(html.dataset.theme).toBe("light");
    html.dataset = {};
    expect(runScript()).toBe("light");
  });

  it("存不了也照樣換色", () => {
    blocked = true;
    setTheme("dark");
    expect(html.dataset.theme).toBe("dark");
  });
});
