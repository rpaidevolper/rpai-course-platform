import { canonicalJson, sha256Hex } from "./hash.ts";
import { asText, parseFrontmatter, stringsIn, stringValue } from "./frontmatter.ts";
import { buildNameTable, type NameStats } from "./names.ts";
import {
  isModuleId,
  sanitizeFramework,
  sanitizeModuleCard,
  sanitizeRecipe,
  sanitizeUnitCard,
  type Sanitized,
} from "./sanitize.ts";
import {
  CLIENT_NAME_FLAG,
  type Frontmatter,
  type KnowledgeDocumentInput,
  type KnowledgeKind,
  type MarkdownFile,
} from "./types.ts";

export interface BuildResult {
  documents: KnowledgeDocumentInput[];
  /** 不是知識庫文件而略過的檔案：沒有 frontmatter，或 frontmatter 不符合任何種類。 */
  skipped: string[];
  /** 硬錯誤。只要有一個就整批不寫入。 */
  errors: string[];
  names: NameStats;
  /** 把文字裡的客戶名稱遮掉（報告用）。 */
  mask: (text: string) => string;
}

interface ParsedFile {
  /** 原始路徑；對外的路徑都要先過 mask。 */
  path: string;
  kind: KnowledgeKind;
  fm: Frontmatter;
  body: string;
  basename: string;
  /** 來源 id：framework 固定是 "framework"，module_card 是模組代號，其他是 frontmatter 的 id（沒有就用檔名）。 */
  sourceId: string;
}

interface Issue {
  path: string;
  message: string;
}

/** 依 frontmatter 的 key 判斷種類；第一個符合的算數，都不符合回 null（不是知識庫文件）。 */
export function classify(fm: Frontmatter): KnowledgeKind | null {
  const has = (key: string) => Object.hasOwn(fm, key);
  if (has("client") || has("units") || fm.extract === "stub") return "recipe";
  if (has("used_in") || has("times_used") || (has("module") && has("minutes"))) return "unit_card";
  if (has("module") && has("env")) return "module_card";
  if (has("version") && has("always_load") && !has("module")) return "framework";
  return null;
}

/**
 * 把資料夾的 Markdown 整批轉成知識庫文件（純函式，不碰資料庫）。
 * 流程：解析與分類 → 建名稱表（只用配方）→ 去識別化 → 掃描客戶名稱加旗標 → 算識別與雜湊 → 檢查硬錯誤。
 */
export function buildKnowledgeDocuments(files: MarkdownFile[], aliasesText: string | null): BuildResult {
  const issues: Issue[] = [];
  const skipped: string[] = [];
  const parsed: ParsedFile[] = [];

  for (const file of files) {
    const result = parseFrontmatter(file.text);
    if (!result.ok) {
      issues.push({ path: file.path, message: result.error });
      continue;
    }
    if (!result.frontmatter) {
      skipped.push(file.path);
      continue;
    }
    const kind = classify(result.frontmatter);
    if (!kind) {
      skipped.push(file.path);
      continue;
    }
    const basename = baseName(file.path);
    const fm = result.frontmatter;
    const sourceId =
      kind === "framework" ? "framework" : kind === "module_card" ? (asText(fm.module) ?? "") : (asText(fm.id) ?? basename);
    parsed.push({ path: file.path, kind, fm, body: result.body, basename, sourceId });
  }

  const names = buildNameTable({
    recipes: parsed
      .filter((p) => p.kind === "recipe")
      .map((p) => ({ id: p.sourceId, client: stringValue(p.fm.client) })),
    aliasesText,
  });

  const documents: KnowledgeDocumentInput[] = [];
  for (const p of parsed) {
    const sanitized = sanitize(p);
    if ((p.kind === "unit_card" || p.kind === "module_card") && !isModuleId(asText(p.fm.module))) {
      issues.push({ path: p.path, message: "module 不是合法的模組代號（A1–B4）" });
    }
    if (p.kind === "module_card" && asText(p.fm.id) !== asText(p.fm.module)) {
      issues.push({ path: p.path, message: "模組卡的 id 必須和 module 相同" });
    }

    const flagged = [sanitized.title, sanitized.body, ...stringsIn(sanitized.frontmatter)].some((text) => names.hits(text));
    const flags = flagged ? [CLIENT_NAME_FLAG] : [];
    documents.push({
      kind: p.kind,
      source_key: sha256Hex(`${p.kind}:${p.sourceId}`),
      modules: sanitized.modules,
      title: sanitized.title,
      frontmatter: sanitized.frontmatter,
      body: sanitized.body,
      content_hash: sha256Hex(
        canonicalJson({
          kind: p.kind,
          title: sanitized.title,
          modules: sanitized.modules,
          frontmatter: sanitized.frontmatter,
          body: sanitized.body,
          flags,
        }),
      ),
      flags,
      path: p.path,
    });
  }

  const pathsByKey = new Map<string, string[]>();
  for (const doc of documents) {
    pathsByKey.set(doc.source_key, [...(pathsByKey.get(doc.source_key) ?? []), doc.path]);
  }
  for (const paths of pathsByKey.values()) {
    if (paths.length > 1) {
      for (const path of paths) issues.push({ path, message: "和另一份文件的來源 id 相同，請改成不同的 id 或檔名" });
    }
  }

  if (!documents.some((doc) => doc.kind === "framework")) {
    issues.push({ path: "", message: "找不到模組框架：資料夾裡要有一份 frontmatter 含 version 與 always_load 的文件" });
  }

  return {
    documents: documents.map((doc) => ({ ...doc, path: names.mask(doc.path) })),
    skipped: skipped.map((path) => names.mask(path)),
    errors: issues.map((issue) => (issue.path ? `${names.mask(issue.path)}：${issue.message}` : issue.message)),
    names: names.stats,
    mask: names.mask,
  };
}

function sanitize(p: ParsedFile): Sanitized {
  switch (p.kind) {
    case "recipe":
      return sanitizeRecipe({ fm: p.fm, body: p.body, id: p.sourceId });
    case "unit_card":
      return sanitizeUnitCard({ fm: p.fm, body: p.body, basename: p.basename });
    case "module_card":
      return sanitizeModuleCard({ fm: p.fm, body: p.body, basename: p.basename });
    case "framework":
      return sanitizeFramework({ fm: p.fm, body: p.body });
  }
}

/** 路徑的最後一段去掉 .md。 */
function baseName(path: string): string {
  return (path.split("/").at(-1) ?? path).replace(/\.md$/, "");
}
