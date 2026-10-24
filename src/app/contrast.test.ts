import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/** 直接解析 globals.css：@theme 是淺色 N5，[data-theme="dark"] 覆寫成深色 D1。色碼只有一份。 */
const css = readFileSync(new URL("./globals.css", import.meta.url), "utf8");
function tokens(selector: string): Map<string, string> {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`找不到區塊：${selector}`);
  const body = css.slice(start, css.indexOf("\n}", start));
  return new Map([...body.matchAll(/--color-([\w-]+):\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1], m[2]]));
}

const MODES: [mode: string, tokens: Map<string, string>][] = [
  ["淺色 N5", tokens("@theme")],
  ["深色 D1", tokens(':root[data-theme="dark"]')],
];

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const AA_SMALL = 4.5;

// 文字 token × 它實際會出現的底色。停用的按鈕不在 WCAG 要求範圍內。
const PAIRS: [text: string, backgrounds: string[]][] = [
  ["ink", ["card", "canvas", "layer", "accent-tint", "accent-tint-hover"]],
  ["accent", ["card", "canvas", "layer", "accent-tint"]],
  ["body", ["card", "canvas", "layer", "accent-tint", "warning-tint"]],
  ["body-muted", ["card", "canvas", "layer"]],
  ["warning", ["card", "warning-tint"]],
  ["success", ["card", "success-tint"]],
  ["danger", ["card", "danger-tint"]],
  ["on-accent", ["accent", "accent-press"]],
];

for (const [mode, t] of MODES) {
  const color = (name: string) => {
    const hex = t.get(name);
    if (!hex) throw new Error(`${mode} 找不到 token：${name}`);
    return hex;
  };

  describe(`${mode} 文字色對比（WCAG AA 小字 4.5:1）`, () => {
    for (const [text, backgrounds] of PAIRS) {
      for (const bg of backgrounds) {
        it(`${text} 在 ${bg} 上`, () => {
          expect(contrast(color(text), color(bg))).toBeGreaterThanOrEqual(AA_SMALL);
        });
      }
    }
  });
}

it("深色模式覆寫了每一個淺色色碼 token", () => {
  const [[, light], [, dark]] = MODES;
  expect([...dark.keys()].sort()).toEqual([...light.keys()].sort());
});
