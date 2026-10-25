import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { MarkdownFile } from "./types.ts";

/**
 * 遞迴讀出資料夾裡所有 .md（路徑用 / 分隔，相對於資料夾，依路徑排序）。
 * 略過以 . 開頭的資料夾與檔案（例如 .git、.trash），以及 node_modules。
 */
export async function readMarkdownFiles(dir: string): Promise<MarkdownFile[]> {
  const files: MarkdownFile[] = [];

  async function walk(absoluteDir: string, relativeDir: string): Promise<void> {
    const entries = await readdir(absoluteDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      const absolute = join(absoluteDir, entry.name);
      const relative = relativeDir === "" ? entry.name : `${relativeDir}/${entry.name}`;
      if (entry.isDirectory()) {
        if (entry.name === "node_modules") continue;
        await walk(absolute, relative);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        files.push({ path: relative, text: await readFile(absolute, "utf8") });
      }
    }
  }

  await walk(dir, "");
  return files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}
