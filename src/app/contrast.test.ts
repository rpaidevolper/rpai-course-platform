import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/** 直接解析 globals.css 的 @theme，色碼只有一份。 */
const css = readFileSync(new URL("./globals.css", import.meta.url), "utf8");
function token(name: string): string {
  const m = css.match(new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!m) throw new Error(`找不到 token：${name}`);
  return m[1];
}

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

const WHITE = "#ffffff";
const AA_SMALL = 4.5;

// 文字 token × 它實際會出現的底色。停用的按鈕不在 WCAG 要求範圍內。
const PAIRS: [text: string, backgrounds: string[]][] = [
  ["navy", [WHITE, token("ice"), token("iced"), token("navy-tint")]],
  ["body", [WHITE, token("ice"), token("iced"), token("navy-tint"), token("warning-tint")]],
  ["body-muted", [WHITE, token("ice"), token("iced")]],
  ["warning", [WHITE, token("warning-tint")]],
  ["success", [WHITE, token("success-tint")]],
  ["danger", [WHITE, token("danger-tint")]],
];

describe("品牌文字色對比（WCAG AA 小字 4.5:1）", () => {
  for (const [text, backgrounds] of PAIRS) {
    for (const bg of backgrounds) {
      it(`${text} 在 ${bg} 上`, () => {
        expect(contrast(token(text), bg)).toBeGreaterThanOrEqual(AA_SMALL);
      });
    }
  }

  it("白字在 navy 按鈕上", () => {
    expect(contrast(WHITE, token("navy"))).toBeGreaterThanOrEqual(AA_SMALL);
  });
});
