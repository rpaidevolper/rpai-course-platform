import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { dbFixture } from "@/test/db";
import { addMember, removeMember, resolveWorkspace } from "./members";

const db = dbFixture();
let ws: string;

async function membership(userId: string) {
  const { data } = await db.admin
    .from("workspace_members")
    .select("display_name")
    .eq("workspace_id", ws)
    .eq("user_id", userId)
    .maybeSingle();
  return data;
}

beforeAll(async () => {
  ws = await db.workspace("members");
});

afterAll(() => db.cleanup());

describe("addMember", () => {
  it("還沒有帳號時先建一個已驗證 email 的帳號，再加進工作區", async () => {
    const email = db.email("new-instructor");
    const result = await addMember(db.admin, { email, displayName: "新講師", workspaceId: ws });
    db.trackUser(result.userId);

    expect(result).toMatchObject({ workspaceId: ws, createdUser: true });
    expect(await membership(result.userId)).toEqual({ display_name: "新講師" });
    const { data } = await db.admin.auth.admin.getUserById(result.userId);
    expect(data.user?.email_confirmed_at).toBeTruthy();
  });

  it("重跑不會重複建帳號，只更新顯示名稱；email 大小寫不同也認得", async () => {
    const email = db.email("rerun");
    const first = await addMember(db.admin, { email, displayName: "舊名字", workspaceId: ws });
    db.trackUser(first.userId);

    const again = await addMember(db.admin, { email: email.toUpperCase(), displayName: "新名字", workspaceId: ws });
    expect(again).toMatchObject({ userId: first.userId, createdUser: false });
    expect(await membership(first.userId)).toEqual({ display_name: "新名字" });
  });

  it("已經有帳號（例如之前被移除過）的人，直接加回去", async () => {
    const existing = await db.user("existing");
    const result = await addMember(db.admin, { email: existing.email, displayName: "回鍋", workspaceId: ws });
    expect(result).toMatchObject({ userId: existing.id, createdUser: false });
  });

  it("顯示名稱不能是空的", async () => {
    await expect(addMember(db.admin, { email: db.email("blank"), displayName: " ", workspaceId: ws })).rejects.toThrow(
      "顯示名稱",
    );
  });
});

describe("removeMember", () => {
  it("移出工作區但保留帳號；本來就不是成員回 false", async () => {
    const user = await db.user("removable", ws);
    expect(await removeMember(db.admin, { email: user.email, workspaceId: ws })).toBe(true);
    expect(await membership(user.id)).toBeNull();
    expect((await db.admin.auth.admin.getUserById(user.id)).data.user).not.toBeNull();

    expect(await removeMember(db.admin, { email: user.email, workspaceId: ws })).toBe(false);
    expect(await removeMember(db.admin, { email: db.email("nobody"), workspaceId: ws })).toBe(false);
  });
});

describe("resolveWorkspace", () => {
  it("有多個工作區時，沒指定就要求指定", async () => {
    // migration 建的那個加上這個檔建的，至少兩個
    await expect(resolveWorkspace(db.admin)).rejects.toThrow("--workspace");
    expect(await resolveWorkspace(db.admin, ws)).toBe(ws);
  });
});
