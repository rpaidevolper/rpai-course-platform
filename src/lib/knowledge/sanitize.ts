import { MODULE_IDS, moduleLabel, type ModuleId } from "../blueprint/modules.ts";
import { specOfHours } from "../blueprint/spec.ts";
import { asText, omitKeys, stringValue } from "./frontmatter.ts";
import { cleanBody } from "./sections.ts";
import type { Frontmatter, FrontmatterScalar, FrontmatterValue } from "./types.ts";

/** 去識別化之後、要存進平台的文字（還沒掃描客戶名稱）。 */
export interface Sanitized {
  title: string;
  modules: string[];
  frontmatter: Frontmatter;
  body: string;
}

export function isModuleId(value: string | null): value is ModuleId {
  return value !== null && (MODULE_IDS as readonly string[]).includes(value);
}

/**
 * 配方：拿掉客戶相關的 frontmatter 與「原始檔」「主簡報」兩節，標題換成中性名稱「產業・模組・規格」。
 * 配方不記錄客戶，所以 id 與原標題（常含客戶名稱）都不存。
 */
export function sanitizeRecipe(input: { fm: Frontmatter; body: string; id: string }): Sanitized {
  const { fm, body, id } = input;
  const modules = moduleList(fm.modules);
  const industry = stringValue(fm.industry) ?? industryFromId(id) ?? "未分產業";
  const spec = typeof fm.hours === "number" ? specOfHours(fm.hours) : null;
  const status = stringValue(fm.status);
  const suffix = status === "提案" ? "（提案）" : status === "籌備中" ? "（籌備中）" : "";
  return {
    title: `${industry}・${modules.length > 0 ? modules.join("、") : "未分模組"}・${spec ?? "時數未定"}${suffix}`,
    modules,
    frontmatter: omitKeys(fm, ["client", "source", "id", "title"]),
    body: cleanBody(body, (title) => title === "原始檔" || title === "主簡報"),
  };
}

/** 單元卡：拿掉使用次數（由配方推得）、「出處」與「講師備註」開頭的章節。 */
export function sanitizeUnitCard(input: { fm: Frontmatter; body: string; basename: string }): Sanitized {
  const { fm, body, basename } = input;
  const moduleCode = asText(fm.module);
  return {
    title: asText(fm.title) ?? basename,
    modules: isModuleId(moduleCode) ? [moduleCode] : [],
    frontmatter: omitKeys(fm, ["used_in", "times_used"]),
    body: cleanBody(body, (title) => title === "出處" || title.startsWith("講師備註")),
  };
}

const MODULE_CARD_DROPPED_SECTIONS = ["產業皮現況", "現況與缺口", "代表課程配方"];

/** 模組卡：標題用模組代號加名稱（例如「A1 通用生成 AI」），拿掉三個會帶出客戶的章節。 */
export function sanitizeModuleCard(input: { fm: Frontmatter; body: string; basename: string }): Sanitized {
  const { fm, body, basename } = input;
  const moduleCode = asText(fm.module);
  return {
    title: isModuleId(moduleCode) ? moduleLabel(moduleCode) : (asText(fm.title) ?? basename),
    modules: isModuleId(moduleCode) ? [moduleCode] : [],
    frontmatter: fm,
    body: cleanBody(body, (title) => MODULE_CARD_DROPPED_SECTIONS.includes(title)),
  };
}

/** 模組框架：不刪東西（只拿掉大標題）。整份是總規則，不屬於任何模組。 */
export function sanitizeFramework(input: { fm: Frontmatter; body: string }): Sanitized {
  return {
    title: asText(input.fm.title) ?? "模組框架",
    modules: [],
    frontmatter: input.fm,
    body: cleanBody(input.body, () => false),
  };
}

/** 配方的 modules：只留合法的模組代號，保留原本的順序。 */
function moduleList(value: FrontmatterValue | undefined): string[] {
  const items: FrontmatterScalar[] = Array.isArray(value) ? value : value === undefined ? [] : [value];
  return items.filter((item): item is string => typeof item === "string" && isModuleId(item));
}

/** stub 的產業前綴（<產業>_...）；第一段是數字（年月）或「提案」時不是產業。 */
function industryFromId(id: string): string | null {
  const first = (id.split("_")[0] ?? "").trim();
  return first !== "" && !/^\d+$/.test(first) && first !== "提案" ? first : null;
}
