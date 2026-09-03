import { describe, expect, it } from "vitest";
import { buildStoragePath, contentTypeFor, sanitizeFilename } from "./artifacts";

describe("contentTypeFor", () => {
  it("認得 pptx / docx，不分大小寫", () => {
    expect(contentTypeFor("deck.PPTX")).toContain("presentationml");
    expect(contentTypeFor("手冊.docx")).toContain("wordprocessingml");
  });

  it("不在清單的副檔名回 null", () => {
    expect(contentTypeFor("script.sh")).toBeNull();
    expect(contentTypeFor("noext")).toBeNull();
  });
});

describe("sanitizeFilename", () => {
  it("去掉路徑與危險字元，保留中文", () => {
    expect(sanitizeFilename("../../週報課_簡報.pptx")).toBe("週報課_簡報.pptx");
    expect(sanitizeFilename("C:\\tmp\\a:b?.docx")).toBe("ab.docx");
  });

  it("空字串或 .. 退回預設名", () => {
    expect(sanitizeFilename("")).toBe("artifact");
    expect(sanitizeFilename("..")).toBe("artifact");
  });
});

describe("buildStoragePath", () => {
  it("四層路徑，檔名經過清理", () => {
    expect(
      buildStoragePath({ ownerId: "o", courseId: "c", artifactId: "a", filename: "x/y.pptx" }),
    ).toBe("o/c/a/y.pptx");
  });
});
