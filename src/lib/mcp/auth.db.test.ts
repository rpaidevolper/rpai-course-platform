import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { dbFixture, type TestUser } from "@/test/db";
import { removeMember } from "@/lib/workspace/members";
import { instructorFrom, verifyApiToken } from "./auth";
import { generateToken } from "./tokens";

const db = dbFixture();
const req = new Request("http://localhost/api/mcp");
let ws: string;
let member: TestUser;
let outsider: TestUser;

/** 用 service role 直接發一組權杖（等同 pnpm token:create），回傳明文與 id。 */
async function issueToken(user: TestUser): Promise<{ token: string; id: string }> {
  const { token, hash, prefix } = generateToken();
  const { data, error } = await db.admin
    .from("api_tokens")
    .insert({ owner_id: user.id, label: "測試", token_hash: hash, token_prefix: prefix })
    .select("id")
    .single();
  if (error) throw error;
  return { token, id: data.id };
}

beforeAll(async () => {
  ws = await db.workspace("mcp-auth");
  member = await db.user("member", ws);
  outsider = await db.user("outsider");
});

afterAll(() => db.cleanup());

describe("verifyApiToken", () => {
  it("成員的權杖對到講師與工作區，並記下最後使用時間", async () => {
    const { token, id } = await issueToken(member);
    const auth = await verifyApiToken(req, token);
    expect(instructorFrom(auth)).toEqual({ userId: member.id, workspaceId: ws });

    const { data } = await db.admin.from("api_tokens").select("last_used_at").eq("id", id).single();
    expect(data!.last_used_at).not.toBeNull();
  });

  it("撤銷的權杖回 undefined（401）", async () => {
    const { token, id } = await issueToken(member);
    await db.admin.from("api_tokens").update({ revoked_at: new Date().toISOString() }).eq("id", id);
    expect(await verifyApiToken(req, token)).toBeUndefined();
  });

  it("不是工作區成員的人，權杖回 undefined", async () => {
    const { token } = await issueToken(outsider);
    expect(await verifyApiToken(req, token)).toBeUndefined();
  });

  it("成員被移出工作區後，原本有效的權杖立刻失效", async () => {
    const leaving = await db.user("leaving", ws);
    const { token } = await issueToken(leaving);
    expect(await verifyApiToken(req, token)).toBeDefined();

    expect(await removeMember(db.admin, { email: leaving.email, workspaceId: ws })).toBe(true);
    expect(await verifyApiToken(req, token)).toBeUndefined();
  });

  it("不像本平台權杖的字串，不查資料庫直接拒絕", async () => {
    expect(await verifyApiToken(req, "not-a-token")).toBeUndefined();
    expect(await verifyApiToken(req, undefined)).toBeUndefined();
  });
});
