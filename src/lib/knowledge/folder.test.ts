import { describe, expect, it } from "vitest";
import { readMarkdownFiles } from "./folder.ts";
import { FIXTURE_DIR } from "./fixtures/load.ts";

describe("readMarkdownFiles 讀資料夾", () => {
  it("遞迴讀出所有 .md，路徑用 / 分隔、依路徑排序，略過 . 開頭的資料夾（.trash）", async () => {
    const files = await readMarkdownFiles(FIXTURE_DIR);
    const paths = files.map((file) => file.path);
    expect(paths).toEqual([...paths].sort());
    expect(paths).toHaveLength(13);
    expect(paths).toContain("單元卡/A2_資料整理實作.md");
    expect(paths).toContain("課程配方/製造_202403_虛構電子_AI導入.md");
    expect(paths).toContain("原始課綱暫存/某課綱.md");
    expect(paths.some((path) => path.startsWith(".trash/"))).toBe(false);
  });

  it("讀到的是檔案內容", async () => {
    const files = await readMarkdownFiles(FIXTURE_DIR);
    const framework = files.find((file) => file.path === "模組框架.md");
    expect(framework?.text.startsWith("---\nid: framework\n")).toBe(true);
  });
});
