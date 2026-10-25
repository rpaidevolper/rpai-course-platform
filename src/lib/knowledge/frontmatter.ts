import type { Frontmatter, FrontmatterScalar, FrontmatterValue } from "./types.ts";

/** 沒有 frontmatter（開頭不是 ---）時 frontmatter 為 null，本文就是整個檔案。 */
export type ParseResult = { ok: true; frontmatter: Frontmatter | null; body: string } | { ok: false; error: string };

const KEY_LINE = /^([A-Za-z_][A-Za-z0-9_-]*):(.*)$/;
const ITEM_LINE = /^\s*-(?:\s+(.*))?$/;
const NUMBER = /^-?\d+(\.\d+)?$/;

/**
 * 解析檔案開頭的 frontmatter（寬鬆的 YAML 子集，不用套件）。
 * 認不得的寫法（縮排的多行文字、巢狀物件、重複的 key）回錯誤。錯誤只寫行號，不寫行的內容，
 * 因為內容可能含客戶名稱，而錯誤會印在同步報告裡。
 */
export function parseFrontmatter(source: string): ParseResult {
  const text = source.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const lines = text.split("\n");
  if (lines[0]?.trim() !== "---") return { ok: true, frontmatter: null, body: text };

  const end = lines.findIndex((line, i) => i > 0 && line.trim() === "---");
  if (end === -1) return { ok: false, error: "frontmatter 沒有結束的 ---" };

  const block = parseBlock(lines.slice(1, end));
  if (!block.ok) return block;
  return { ok: true, frontmatter: block.frontmatter, body: lines.slice(end + 1).join("\n") };
}

/** 值的轉換：空字串、null、~ → null；布林；數字；去掉引號的字串；其他原樣保留（例如 2026-10-01）。 */
export function parseScalar(raw: string): FrontmatterScalar {
  const v = raw.trim();
  if (v === "" || v === "null" || v === "~") return null;
  if (v === "true") return true;
  if (v === "false") return false;
  if (NUMBER.test(v)) return Number(v);
  const quote = v.charAt(0);
  if (v.length >= 2 && (quote === '"' || quote === "'") && v.endsWith(quote)) return v.slice(1, -1);
  return v;
}

/** 值是 key 後面的文字：[a, b, "c, d"] 是陣列，其他是單一值。 */
function parseValue(raw: string): FrontmatterValue {
  if (raw.startsWith("[") && raw.endsWith("]")) {
    const inner = raw.slice(1, -1);
    return inner.trim() === "" ? [] : splitInline(inner).map(parseScalar);
  }
  return parseScalar(raw);
}

/** 依逗號切開，引號（只在元素開頭才算）裡的逗號不切。 */
function splitInline(inner: string): string[] {
  const parts: string[] = [];
  let current = "";
  let quote: string | null = null;
  for (const ch of inner) {
    if (quote !== null) {
      current += ch;
      if (ch === quote) quote = null;
    } else if ((ch === '"' || ch === "'") && current.trim() === "") {
      quote = ch;
      current += ch;
    } else if (ch === ",") {
      parts.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  parts.push(current);
  return parts;
}

type BlockResult = { ok: true; frontmatter: Frontmatter } | { ok: false; error: string };

function parseBlock(lines: string[]): BlockResult {
  const values = new Map<string, FrontmatterValue>();
  // 目前正在收集區塊陣列的 key（它的值是空的，後面接著 - 項目）
  let listKey: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNo = i + 2; // 第 1 行是開頭的 ---
    const at = (message: string): BlockResult => ({ ok: false, error: `第 ${lineNo} 行：${message}` });

    if (line.trim() === "" || line.trim().startsWith("#")) continue;

    const item = ITEM_LINE.exec(line);
    if (item) {
      if (listKey === null) return at("- 項目前面沒有空值的 key");
      const current = values.get(listKey);
      const value = parseScalar(item[1] ?? "");
      values.set(listKey, Array.isArray(current) ? [...current, value] : [value]);
      continue;
    }

    const kv = KEY_LINE.exec(line);
    if (kv) {
      const key = kv[1];
      if (values.has(key)) return at(`重複的 key：${key}`);
      const raw = kv[2].trim();
      if (raw === "") {
        values.set(key, null);
        listKey = key;
      } else {
        values.set(key, parseValue(raw));
        listKey = null;
      }
      continue;
    }

    return at("認不得的寫法（縮排的多行文字與巢狀結構目前不支援）");
  }

  return { ok: true, frontmatter: Object.fromEntries(values) };
}

/** 值當文字用：字串與數字（例如 id: 202405）都轉成文字；空字串、布林、null、陣列回 null。 */
export function asText(value: FrontmatterValue | undefined): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number") return String(value);
  return null;
}

/** 只接受字串（客戶、產業這類「字串才算」的欄位）。 */
export function stringValue(value: FrontmatterValue | undefined): string | null {
  return typeof value === "string" ? value.trim() || null : null;
}

/** frontmatter 裡所有字串值，陣列裡的字串也算。 */
export function stringsIn(fm: Frontmatter): string[] {
  return Object.values(fm)
    .flatMap((value) => (Array.isArray(value) ? value : [value]))
    .filter((value): value is string => typeof value === "string");
}

/** 去掉指定的 key，其餘原樣保留。 */
export function omitKeys(fm: Frontmatter, keys: readonly string[]): Frontmatter {
  return Object.fromEntries(Object.entries(fm).filter(([key]) => !keys.includes(key)));
}
