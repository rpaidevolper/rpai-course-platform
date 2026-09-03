import { describe, expect, it } from "vitest";
import { generateToken, hashToken, looksLikeToken, TOKEN_PREFIX } from "./tokens";

describe("tokens", () => {
  it("產生的權杖帶前綴，且 hash 可重算", () => {
    const { token, hash, prefix } = generateToken();
    expect(token.startsWith(TOKEN_PREFIX)).toBe(true);
    expect(hashToken(token)).toBe(hash);
    expect(token.startsWith(prefix)).toBe(true);
    expect(prefix.length).toBe(TOKEN_PREFIX.length + 6);
  });

  it("每次產生都不同", () => {
    expect(generateToken().token).not.toBe(generateToken().token);
  });

  it("能辨識不像權杖的字串", () => {
    expect(looksLikeToken(undefined)).toBe(false);
    expect(looksLikeToken("Bearer x")).toBe(false);
    expect(looksLikeToken("rcp_short")).toBe(false);
    expect(looksLikeToken(generateToken().token)).toBe(true);
  });
});
