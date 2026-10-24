import { describe, expect, it } from "vitest";
import { isLocalSupabaseUrl } from "./local";

describe("isLocalSupabaseUrl", () => {
  it("本機 Supabase 的網址", () => {
    expect(isLocalSupabaseUrl("http://127.0.0.1:54321")).toBe(true);
    expect(isLocalSupabaseUrl("http://localhost:54321")).toBe(true);
  });

  it("雲端專案、空值與壞掉的網址都不是", () => {
    expect(isLocalSupabaseUrl("https://abcdefgh.supabase.co")).toBe(false);
    expect(isLocalSupabaseUrl("https://127.0.0.1.example.com")).toBe(false);
    expect(isLocalSupabaseUrl(undefined)).toBe(false);
    expect(isLocalSupabaseUrl("")).toBe(false);
    expect(isLocalSupabaseUrl("not a url")).toBe(false);
  });
});
