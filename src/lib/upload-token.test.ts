import { describe, expect, it } from "vitest";
import {
  createUploadToken,
  platformBaseUrl,
  UPLOAD_TOKEN_TTL_SECONDS,
  uploadPageUrl,
  verifyUploadToken,
} from "./upload-token";

const NOW = new Date("2026-10-25T03:00:00.000Z");
const ms = (seconds: number) => seconds * 1000;

describe("createUploadToken / verifyUploadToken", () => {
  it("正確的權杖在 2 小時內通過", () => {
    const { token, meta } = createUploadToken(NOW);
    const justBeforeExpiry = new Date(NOW.getTime() + ms(UPLOAD_TOKEN_TTL_SECONDS) - 1000);
    expect(verifyUploadToken(token, meta, NOW)).toBe(true);
    expect(verifyUploadToken(token, meta, justBeforeExpiry)).toBe(true);
  });

  it("meta 存的是到期時間為 now + 2 小時，而且不含明文權杖", () => {
    const { token, meta } = createUploadToken(NOW);
    expect(meta.upload_expires_at).toBe(new Date(NOW.getTime() + ms(2 * 60 * 60)).toISOString());
    expect(JSON.stringify(meta)).not.toContain(token);
  });

  it("到期後（含之後任何時間）不通過", () => {
    const { token, meta } = createUploadToken(NOW);
    const justAfterExpiry = new Date(NOW.getTime() + ms(UPLOAD_TOKEN_TTL_SECONDS) + 1);
    expect(verifyUploadToken(token, meta, justAfterExpiry)).toBe(false);
    expect(verifyUploadToken(token, meta, new Date(NOW.getTime() + ms(UPLOAD_TOKEN_TTL_SECONDS * 2)))).toBe(false);
  });

  it("錯的權杖不通過；每次產生的權杖都不同", () => {
    const first = createUploadToken(NOW);
    const second = createUploadToken(NOW);
    expect(first.token).not.toBe(second.token);
    expect(verifyUploadToken(second.token, first.meta, NOW)).toBe(false);
    expect(verifyUploadToken(`${first.token}x`, first.meta, NOW)).toBe(false);
  });

  it("沒有權杖、或權杖是空字串，不通過", () => {
    const { meta } = createUploadToken(NOW);
    expect(verifyUploadToken(null, meta, NOW)).toBe(false);
    expect(verifyUploadToken(undefined, meta, NOW)).toBe(false);
    expect(verifyUploadToken("", meta, NOW)).toBe(false);
  });

  it("meta 缺欄位或型別不對，一律不通過", () => {
    const { token, meta } = createUploadToken(NOW);
    const bad: (Record<string, unknown> | null | undefined)[] = [
      null,
      undefined,
      {},
      { upload_token_hash: meta.upload_token_hash },
      { upload_expires_at: meta.upload_expires_at },
      { upload_token_hash: 123, upload_expires_at: meta.upload_expires_at },
      { upload_token_hash: meta.upload_token_hash, upload_expires_at: 1798000000 },
      { upload_token_hash: meta.upload_token_hash, upload_expires_at: "不是日期" },
    ];
    for (const candidate of bad) {
      expect(verifyUploadToken(token, candidate, NOW)).toBe(false);
    }
  });
});

describe("platformBaseUrl", () => {
  it("有設定 PLATFORM_BASE_URL 就用它，優先於 Vercel 的網域", () => {
    expect(
      platformBaseUrl({ PLATFORM_BASE_URL: "https://rpai.example.com", VERCEL_PROJECT_PRODUCTION_URL: "x.vercel.app" }),
    ).toBe("https://rpai.example.com");
  });

  it("沒設定 PLATFORM_BASE_URL 時，用 Vercel 的正式網域", () => {
    expect(platformBaseUrl({ VERCEL_PROJECT_PRODUCTION_URL: "rpai.vercel.app" })).toBe("https://rpai.vercel.app");
  });

  it("兩者都沒有時用本機", () => {
    expect(platformBaseUrl({})).toBe("http://localhost:3000");
    expect(platformBaseUrl({ PLATFORM_BASE_URL: "", VERCEL_PROJECT_PRODUCTION_URL: "" })).toBe("http://localhost:3000");
  });

  it("去掉結尾的 /", () => {
    expect(platformBaseUrl({ PLATFORM_BASE_URL: "https://rpai.example.com/" })).toBe("https://rpai.example.com");
    expect(platformBaseUrl({ PLATFORM_BASE_URL: "https://rpai.example.com///" })).toBe("https://rpai.example.com");
  });
});

describe("uploadPageUrl", () => {
  it("組成 base/u/產物 id?t=權杖，權杖會做 URL 編碼", () => {
    expect(uploadPageUrl("https://rpai.example.com", "abc-123", "a+b/c=")).toBe(
      "https://rpai.example.com/u/abc-123?t=a%2Bb%2Fc%3D",
    );
  });
});
