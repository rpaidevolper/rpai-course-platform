import { describe, expect, it } from "vitest";
import { cleanBody } from "./sections.ts";

describe("cleanBody 本文整理", () => {
  const body = [
    "# 大標題",
    "",
    "前言",
    "",
    "## 原始檔",
    "- 路徑",
    "### 子節",
    "內容",
    "",
    "",
    "",
    "## 課程重點",
    "重點",
  ].join("\n");

  it("拿掉大標題，連同 ### 子節一起刪掉指定的章節，前言與其他章節保留", () => {
    expect(cleanBody(body, (title) => title === "原始檔")).toBe("前言\n\n## 課程重點\n重點");
  });

  it("沒有要刪的章節時只拿掉大標題，三個以上的換行壓成兩個", () => {
    expect(cleanBody(body, () => false)).toBe("前言\n\n## 原始檔\n- 路徑\n### 子節\n內容\n\n## 課程重點\n重點");
  });

  it("前言不屬於任何章節，不會被刪", () => {
    expect(cleanBody("前言一\n## 甲\n內容", () => true)).toBe("前言一");
  });

  it("標題行的前後空白不影響章節比對", () => {
    expect(cleanBody("## 出處  \n路徑\n## 其他\n內容", (title) => title === "出處")).toBe("## 其他\n內容");
  });
});
