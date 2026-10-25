import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { readMarkdownFiles } from "../folder.ts";
import type { MarkdownFile } from "../types.ts";

/** 測試用的虛構知識庫資料夾與別名檔（全部虛構）。 */
export const FIXTURE_DIR = fileURLToPath(new URL("./kb", import.meta.url));
export const ALIASES_PATH = fileURLToPath(new URL("./aliases.txt", import.meta.url));

/** fixture 裡的客戶名稱：配方的 client、配方 id 的客戶段、別名檔。可送出的文字裡一個都不能出現。 */
export const FIXTURE_CLIENT_NAMES = ["虛構精密工業", "虛構精密", "虛工", "虛構物流", "虛構電子", "FakeLogi", "虛精"];

export async function loadFixture(): Promise<{ files: MarkdownFile[]; aliasesText: string }> {
  return {
    files: await readMarkdownFiles(FIXTURE_DIR),
    aliasesText: await readFile(ALIASES_PATH, "utf8"),
  };
}
