import { KNOWN_INDUSTRIES } from "./industries.ts";

/** 不算客戶的名稱：團隊自己的品牌與產業名稱（比對不分大小寫）。 */
const BUILTIN_EXCEPTIONS: readonly string[] = ["RPAI", ...KNOWN_INDUSTRIES];

/** 遮掉客戶名稱時換上的字。 */
const MASK_TEXT = "〔已遮蔽〕";

export interface NameStats {
  /** 名稱表的名稱總數 */
  total: number;
  /** 只來自配方（client 欄位或 id 的客戶段）、別名檔沒列的名稱數 */
  fromRecipes: number;
  /** 別名檔列出的名稱數 */
  fromAliases: number;
  /** 名稱表裡 2 個字以下（[...name].length <= 2）的名稱數。這類名稱容易誤判；報告只印數量，不印名稱。 */
  short: number;
}

export interface NameTable {
  /** 文字裡有沒有命中任何名稱（不分大小寫；比對規則見 patternOf）。 */
  hits(text: string): boolean;
  /** 把命中的名稱換成遮罩字。檔名與路徑都要過這一關，報告才不會印出名稱。 */
  mask(text: string): string;
  /** 只有數量，不含名稱。 */
  stats: NameStats;
}

/** 配方的名稱來源：id（frontmatter 的 id，沒有就用檔名去掉 .md）與 client（只取字串）。 */
export interface RecipeNameSource {
  id: string;
  client: string | null;
}

const lower = (text: string): string => text.toLowerCase();
const charCount = (text: string): number => [...text].length;
const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** 全部由 ASCII 字元組成的名稱（字母、數字、空白或標點，例如 GE、3M、C&A）；含中文或其他字元的不是。 */
const isAsciiName = (name: string): boolean => [...name].every((char) => char.charCodeAt(0) < 0x80);

/**
 * 單一名稱的比對樣式（hits 與 mask 共用，所以兩者的比對邏輯一致）：
 * - 英文名只比對完整的詞：前後一個字元都不能是 ASCII 字母或數字。所以 GE 不命中 AGENT、manaGEment，
 *   但命中「GE 的講師」「與GE合作」「(GE)」。
 * - 含中文或其他非 ASCII 字元的名稱，直接比對子字串，因為中文沒有字詞邊界。
 * 這裡不用 \b：名稱以標點開頭或結尾時，\b 會判錯。
 */
const patternOf = (name: string): string => {
  const escaped = escapeRegExp(name);
  return isAsciiName(name) ? `(?<![A-Za-z0-9])${escaped}(?![A-Za-z0-9])` : escaped;
};

/**
 * 配方 id 的客戶段（沒有就回 null）：
 * - 第一段是 6 位數字（年月）或「提案」：客戶是第二段，例如 202405_虛構精密_AI週報實戰、提案_虛構物流_AI入門；
 * - 其他（stub 的 <產業>_<YYYYMM>_<客戶>_<主題>）：第二段開頭是數字時，客戶是第三段。
 */
export function clientSegmentOf(id: string): string | null {
  const parts = id.split("_");
  const first = parts[0] ?? "";
  if (/^\d{6}$/.test(first) || first === "提案") return segment(parts[1]);
  if (/^\d/.test(parts[1] ?? "")) return segment(parts[2]);
  return null;
}

function segment(part: string | undefined): string | null {
  const trimmed = part?.trim() ?? "";
  return trimmed === "" ? null : trimmed;
}

/** 別名檔：一行一個名稱；空行與 # 開頭的行略過；! 開頭是「不是客戶名稱」的例外（例如 !RPAI）。 */
export function parseAliases(text: string | null): { names: string[]; exceptions: string[] } {
  const names: string[] = [];
  const exceptions: string[] = [];
  for (const raw of (text ?? "").split(/\r?\n/)) {
    const line = raw.trim();
    if (line === "" || line.startsWith("#")) continue;
    if (line.startsWith("!")) {
      const name = line.slice(1).trim();
      if (name !== "") exceptions.push(name);
    } else {
      names.push(line);
    }
  }
  return { names, exceptions };
}

/**
 * 建立名稱表（只在記憶體裡，不寫進任何檔案或資料庫）。
 * 來源：配方的 client、配方 id 的客戶段、別名檔。排除內建例外與別名檔的 ! 例外。
 * 所有名稱不分長短都比對，比對規則見 patternOf。
 */
export function buildNameTable(input: { recipes: RecipeNameSource[]; aliasesText: string | null }): NameTable {
  const aliases = parseAliases(input.aliasesText);
  const exceptionKeys = new Set([...BUILTIN_EXCEPTIONS, ...aliases.exceptions].map(lower));

  const aliasNames = new Map<string, string>();
  for (const name of aliases.names) {
    if (!exceptionKeys.has(lower(name))) aliasNames.set(lower(name), name);
  }

  const recipeNames = new Map<string, string>();
  for (const recipe of input.recipes) {
    for (const name of [recipe.client, clientSegmentOf(recipe.id)]) {
      if (name && !exceptionKeys.has(lower(name))) recipeNames.set(lower(name), name);
    }
  }
  const table = new Map<string, string>([...recipeNames, ...aliasNames]);
  // 長的名稱排在前面：遮罩時「虛構精密工業」要先於「虛構精密」比對。
  const byLength = [...table.values()].sort((a, b) => charCount(b) - charCount(a));
  const pattern = byLength.map(patternOf).join("|");
  // hits 用不帶 g 的版本（帶 g 的 RegExp 用 test 會記住 lastIndex）；mask 用帶 g 的版本。兩者樣式相同。
  const hitPattern = pattern === "" ? null : new RegExp(pattern, "i");
  const maskPattern = pattern === "" ? null : new RegExp(pattern, "gi");

  return {
    hits: (text) => hitPattern?.test(text) ?? false,
    mask: (text) => (maskPattern ? text.replace(maskPattern, MASK_TEXT) : text),
    stats: {
      total: table.size,
      fromRecipes: [...recipeNames.keys()].filter((key) => !aliasNames.has(key)).length,
      fromAliases: aliasNames.size,
      short: byLength.filter((name) => charCount(name) <= 2).length,
    },
  };
}
