import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { dbFixture, type TestUser } from "@/test/db";
import { createApiToken, listApiTokens, revokeApiToken } from "./api-tokens";
import { verifyApiToken } from "./auth";

// 設定頁的權杖管理（spec.md U6）：走講師自己的 session，RLS 只讓本人讀寫。
const db = dbFixture();
const req = new Request("http://localhost/api/mcp");
let me: TestUser;
let colleague: TestUser;

beforeAll(async () => {
  const ws = await db.workspace("tokens");
  me = await db.user("me", ws);
  colleague = await db.user("colleague", ws);
});

afterAll(() => db.cleanup());

describe("權杖管理", () => {
  it("產生的權杖馬上能用來呼叫 MCP；列表只有前綴，沒有明文與 hash", async () => {
    const { token, row } = await createApiToken(me.client, me.id, "  我的筆電  ");
    expect(row.label).toBe("我的筆電");
    expect(token.startsWith(row.token_prefix)).toBe(true);
    expect(await verifyApiToken(req, token)).toBeDefined();

    const listed = await listApiTokens(me.client);
    expect(listed.map((t) => t.id)).toContain(row.id);
    expect(JSON.stringify(listed)).not.toContain(token);
    expect(listed[0]).not.toHaveProperty("token_hash");
  });

  it("撤銷後 MCP 立刻回 401，再撤銷一次回 false", async () => {
    const { token, row } = await createApiToken(me.client, me.id, "要撤銷的");
    expect(await revokeApiToken(me.client, row.id)).toBe(true);
    expect(await verifyApiToken(req, token)).toBeUndefined();
    expect(await revokeApiToken(me.client, row.id)).toBe(false);

    const listed = await listApiTokens(me.client);
    expect(listed.find((t) => t.id === row.id)?.revoked_at).not.toBeNull();
  });

  it("同工作區的講師看不到、也撤銷不了我的權杖", async () => {
    const { token, row } = await createApiToken(me.client, me.id, "別人碰不到");
    expect((await listApiTokens(colleague.client)).map((t) => t.id)).not.toContain(row.id);
    expect(await revokeApiToken(colleague.client, row.id)).toBe(false);
    expect(await verifyApiToken(req, token)).toBeDefined();
  });

  it("不能替別人產生權杖", async () => {
    await expect(createApiToken(colleague.client, me.id, "冒名")).rejects.toMatchObject({ code: "42501" });
  });

  it("標籤不能是空的", async () => {
    await expect(createApiToken(me.client, me.id, "   ")).rejects.toThrow("請填標籤");
  });
});
