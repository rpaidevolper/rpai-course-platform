import { describe, expect, it } from "vitest";
import { asText, parseFrontmatter, parseScalar, stringValue } from "./frontmatter.ts";

describe("parseFrontmatter 解析 frontmatter", () => {
  it("開頭不是 --- 的檔案沒有 frontmatter，本文就是整個檔案", () => {
    expect(parseFrontmatter("# 標題\n\n內文")).toEqual({ ok: true, frontmatter: null, body: "# 標題\n\n內文" });
  });

  it("各種值的轉換：空值、布林、數字、引號、行內陣列、冒號、日期", () => {
    const result = parseFrontmatter(
      [
        "---",
        "# 這一行是註解，略過",
        "title: AI 入門: 實作篇",
        "empty:",
        "nothing: null",
        "tilde: ~",
        "flag: true",
        "off: false",
        "count: 12",
        "ratio: -3.5",
        'quoted: "a: b"',
        "single: 'x, y'",
        'tags: [A1, "B2, 特別", 3, true]',
        "none: []",
        "dates: 2026-10-01",
        "---",
        "正文",
      ].join("\n"),
    );
    expect(result).toEqual({
      ok: true,
      frontmatter: {
        title: "AI 入門: 實作篇",
        empty: null,
        nothing: null,
        tilde: null,
        flag: true,
        off: false,
        count: 12,
        ratio: -3.5,
        quoted: "a: b",
        single: "x, y",
        tags: ["A1", "B2, 特別", 3, true],
        none: [],
        dates: "2026-10-01",
      },
      body: "正文",
    });
  });

  it("值是空的 key，後面接的 - 項目（縮排或不縮排）是區塊陣列", () => {
    const result = parseFrontmatter("---\nmodules:\n  - A1\n  - B2\nsteps:\n- 第一\n- 第二\nafter: 值\n---\n本文");
    expect(result).toEqual({
      ok: true,
      frontmatter: { modules: ["A1", "B2"], steps: ["第一", "第二"], after: "值" },
      body: "本文",
    });
  });

  it("值的冒號只看第一個冒號：title: AI 入門: 實作篇 的值是整段", () => {
    const result = parseFrontmatter("---\ntitle: AI 入門: 實作篇\n---\n");
    expect(result).toMatchObject({ ok: true, frontmatter: { title: "AI 入門: 實作篇" } });
  });

  it("CRLF 換行與 BOM 照常解析", () => {
    expect(parseFrontmatter("\uFEFF---\r\ntitle: 甲\r\n---\r\n本文")).toEqual({
      ok: true,
      frontmatter: { title: "甲" },
      body: "本文",
    });
  });

  it("沒有結束的 --- 回錯誤", () => {
    expect(parseFrontmatter("---\ntitle: 甲\n本文")).toMatchObject({ ok: false });
  });

  it.each([
    ["縮排的多行文字", "text: |\n  第一行", 3],
    ["巢狀物件", "a:\n  b: 1", 3],
    ["沒有 key 的行", "just text", 2],
    ["列表項目前面沒有空值的 key", "- 甲", 2],
    ["有值的 key 後面接 - 項目", "modules: A1\n- A2", 3],
    ["重複的 key", "a: 1\na: 2", 3],
  ])("認不得的寫法回錯誤（%s），錯誤只寫行號、不寫行的內容", (_, block, line) => {
    const result = parseFrontmatter(`---\n${block}\n---\n`);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.startsWith(`第 ${line} 行：`)).toBe(true);
      expect(result.error).not.toContain("just text");
      expect(result.error).not.toContain("第一行");
    }
  });
});

describe("parseScalar 單一值的轉換", () => {
  it.each([
    ["", null],
    ["  ", null],
    ["null", null],
    ["~", null],
    ["true", true],
    ["false", false],
    ["007", 7],
    ["-0.5", -0.5],
    ["2026-10-01", "2026-10-01"],
    ["'單引號'", "單引號"],
    ['"雙引號"', "雙引號"],
    ['"', '"'],
    ["L1–L3", "L1–L3"],
  ])("%j → %j", (raw, expected) => {
    expect(parseScalar(raw)).toBe(expected);
  });
});

describe("asText 與 stringValue", () => {
  it("asText 數字也當文字；空字串與陣列回 null", () => {
    expect(asText(202405)).toBe("202405");
    expect(asText("  A1 ")).toBe("A1");
    expect(asText("  ")).toBeNull();
    expect(asText(["A1"])).toBeNull();
    expect(asText(undefined)).toBeNull();
  });

  it("stringValue 只接受字串", () => {
    expect(stringValue(202405)).toBeNull();
    expect(stringValue(" 虛構 ")).toBe("虛構");
  });
});
