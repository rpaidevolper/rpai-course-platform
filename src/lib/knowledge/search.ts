import { KNOWLEDGE_KINDS, type KnowledgeDocument, type KnowledgeKind } from "./types.ts";

export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 50;
const SNIPPET_CHARS = 120;
/** 命中處之前保留的字數，其餘給命中處之後。 */
const SNIPPET_BEFORE_HIT = 40;

/** 能不能送給 AI：沒有退役，而且沒有任何旗標（帶旗標的文字含客戶名稱，AI 不能看到）。 */
export function isServable(doc: KnowledgeDocument): boolean {
  return !doc.retired_at && doc.flags.length === 0;
}

export interface SearchOptions {
  /** 關鍵字用空白分開，不分大小寫。 */
  query?: string;
  kind?: KnowledgeKind;
  module?: string;
  limit?: number;
}

export interface SearchHit {
  id: string;
  kind: KnowledgeKind;
  modules: string[];
  title: string;
  snippet: string;
}

/**
 * 搜尋知識庫（純函式）。先只留能送給 AI 的文件，再依 kind、module 過濾。
 * 有關鍵字：每個關鍵字在標題命中加 3 分、在本文命中加 1 分，0 分的不要，分數高的在前。
 * 沒有關鍵字：依種類（框架、模組卡、單元卡、配方）再依標題排序。
 */
export function searchKnowledge(docs: KnowledgeDocument[], options: SearchOptions = {}): SearchHit[] {
  const tokens = (options.query ?? "").toLowerCase().split(/\s+/).filter((token) => token !== "");
  const limit = Math.min(options.limit ?? DEFAULT_LIMIT, MAX_LIMIT);

  const matched = docs
    .filter((doc) => isServable(doc))
    .filter((doc) => !options.kind || doc.kind === options.kind)
    .filter((doc) => !options.module || doc.modules.includes(options.module))
    .map((doc) => ({ doc, score: scoreOf(doc, tokens) }))
    .filter(({ score }) => tokens.length === 0 || score > 0);

  matched.sort((a, b) => b.score - a.score || compareDefault(a.doc, b.doc));

  return matched.slice(0, limit).map(({ doc }) => ({
    id: doc.id,
    kind: doc.kind,
    modules: doc.modules,
    title: doc.title,
    snippet: snippetOf(doc, tokens),
  }));
}

function scoreOf(doc: KnowledgeDocument, tokens: string[]): number {
  const title = doc.title.toLowerCase();
  const body = doc.body.toLowerCase();
  return tokens.reduce((sum, token) => sum + (title.includes(token) ? 3 : 0) + (body.includes(token) ? 1 : 0), 0);
}

function compareDefault(a: KnowledgeDocument, b: KnowledgeDocument): number {
  return (
    KNOWLEDGE_KINDS.indexOf(a.kind) - KNOWLEDGE_KINDS.indexOf(b.kind) || compareText(a.title, b.title) || compareText(a.id, b.id)
  );
}

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** 有關鍵字且本文命中：取第一個命中處前後的文字。否則取本文去掉 # 標題行後的前段。 */
function snippetOf(doc: KnowledgeDocument, tokens: string[]): string {
  if (tokens.length > 0) {
    const lowered = doc.body.toLowerCase();
    const hits = tokens.map((token) => lowered.indexOf(token)).filter((index) => index >= 0);
    if (hits.length > 0) return excerpt(doc.body, Math.min(...hits) - SNIPPET_BEFORE_HIT, SNIPPET_CHARS);
  }
  const plain = doc.body
    .split("\n")
    .filter((line) => !line.startsWith("#"))
    .join("\n");
  return excerpt(plain, 0, SNIPPET_CHARS);
}

/** 取一段文字，把空白收成一個，不切斷代理對；截斷的兩端加「…」。 */
function excerpt(text: string, start: number, length: number): string {
  let from = Math.min(Math.max(0, start), text.length);
  let to = Math.min(text.length, from + length);
  if (from > 0 && isLowSurrogate(text.charCodeAt(from))) from++;
  if (to < text.length && isHighSurrogate(text.charCodeAt(to - 1))) to--;
  const middle = text.slice(from, to).replace(/\s+/g, " ").trim();
  return `${from > 0 ? "…" : ""}${middle}${to < text.length ? "…" : ""}`;
}

const isHighSurrogate = (code: number): boolean => code >= 0xd800 && code <= 0xdbff;
const isLowSurrogate = (code: number): boolean => code >= 0xdc00 && code <= 0xdfff;
