import { describe, expect, it } from "vitest";
import {
  ARTIFACT_KINDS,
  artifactDownloadOptions,
  artifactExtension,
  buildStoragePath,
  contentTypeFor,
  sanitizeFilename,
} from "./artifacts";

describe("contentTypeFor", () => {
  it("認得 pptx / docx，不分大小寫", () => {
    expect(contentTypeFor("deck.PPTX")).toContain("presentationml");
    expect(contentTypeFor("手冊.docx")).toContain("wordprocessingml");
  });

  it("學員手冊是 HTML 單檔，白名單收 .html", () => {
    expect(contentTypeFor("手冊_Day1.html")).toBe("text/html");
    expect(contentTypeFor("手冊.HTML")).toBe("text/html");
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

describe("artifactExtension", () => {
  it("handbook 是 .html，slides 是 .pptx，outline 是 .docx", () => {
    expect(artifactExtension("handbook")).toBe(".html");
    expect(artifactExtension("slides")).toBe(".pptx");
    expect(artifactExtension("outline")).toBe(".docx");
  });

  it("每個產物種類的副檔名都在上傳白名單裡", () => {
    for (const kind of ARTIFACT_KINDS) {
      expect(contentTypeFor(`x${artifactExtension(kind)}`)).not.toBeNull();
    }
  });
});

describe("artifactDownloadOptions", () => {
  it("帶 download 檔名，讓回應是 attachment，不在平台網域渲染", () => {
    expect(artifactDownloadOptions("o/c/a/手冊_Day1.html")).toEqual({ download: "手冊_Day1.html" });
  });

  it("檔名經過清理；空檔名退回預設名", () => {
    expect(artifactDownloadOptions('../x"y.html')).toEqual({ download: "xy.html" });
    expect(artifactDownloadOptions("")).toEqual({ download: "artifact" });
  });
});
