import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/** 這個檔案在 src/app/demo/。要檢查的是設計稿，加上設計稿用到的共用元件（src/app/_components）。 */
const APP_DIR = fileURLToPath(new URL("..", import.meta.url));
const SCAN_DIRS = [join(APP_DIR, "demo"), join(APP_DIR, "_components")];

/** 目錄底下所有 .ts／.tsx 原始碼，測試檔除外。 */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    const isSource = /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name);
    return isSource ? [path] : [];
  });
}

/**
 * 單引號、雙引號或反引號裡、以 `/` 開頭的字串，例如 href="/projects"、router.push(`/courses/${id}`)。
 * 不只看 href= 後面：變數（portalPath）、物件（NAV 的 href:）、預設值（backHref = "/"）也要抓到。
 */
const PATH_STRING = /(["'`])(\/[^"'`]*)\1/g;

describe("設計稿的站內路徑都在 /demo 底下", () => {
  it("每個 / 開頭的字串都是 /demo 或 /demo/ 開頭", () => {
    const offenders: string[] = [];
    let found = 0;

    for (const file of SCAN_DIRS.flatMap(sourceFiles)) {
      readFileSync(file, "utf8")
        .split("\n")
        .forEach((line, index) => {
          for (const [, , path] of line.matchAll(PATH_STRING)) {
            found++;
            if (path !== "/demo" && !path.startsWith("/demo/")) {
              offenders.push(`${relative(APP_DIR, file)}:${index + 1}  ${path}`);
            }
          }
        });
    }

    expect(offenders).toEqual([]);
    // 掃到的太少，代表規則寫壞了（會讓上面的檢查形同虛設）
    expect(found).toBeGreaterThan(20);
  });
});
