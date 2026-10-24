// 工作區成員的加入與移除（待決-3：由 owner 執行 `pnpm member:add` / `pnpm member:remove`，第一位成員也用它建立）。
// 一律用 service role client。scripts/member.ts 直接用 Node 執行這個檔，所以只能用相對路徑 import，不能用 `@/`。
import type { SupabaseClient } from "@supabase/supabase-js";

export interface MemberInput {
  email: string;
  /** 不給就用唯一的那個工作區；有多個工作區時一定要給。 */
  workspaceId?: string;
}

export interface AddMemberInput extends MemberInput {
  displayName: string;
  /** 只給本機開發用：讓這個帳號能用登入頁的密碼表單登入。production 的帳號一律用 Google 登入，不設密碼。 */
  password?: string;
}

export interface AddMemberResult {
  userId: string;
  workspaceId: string;
  /** 這次才建立 auth 帳號（之前沒登入過、也沒被加過）。 */
  createdUser: boolean;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** 沒指定就取唯一的工作區（全團隊只有一個，ADR 0004）；指定了就確認它存在。 */
export async function resolveWorkspace(admin: SupabaseClient, workspaceId?: string): Promise<string> {
  let query = admin.from("workspaces").select("id");
  if (workspaceId) query = query.eq("id", workspaceId);
  const { data, error } = await query.limit(2);
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error(workspaceId ? `找不到工作區 ${workspaceId}` : "還沒有任何工作區（migration 0005 會建立一個）");
  }
  if (data.length > 1) throw new Error("有多個工作區，請用 --workspace 指定");
  return data[0].id as string;
}

/** 依 email 找 auth 帳號。Admin API 沒有依 email 查的方法，只能翻頁；團隊規模小，翻完也很快。 */
export async function findUserIdByEmail(admin: SupabaseClient, email: string): Promise<string | null> {
  const target = normalizeEmail(email);
  const perPage = 1000;
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const user = data.users.find((u) => u.email?.toLowerCase() === target);
    if (user) return user.id;
    if (data.users.length < perPage) return null;
  }
}

/**
 * 把一個人加進工作區。還沒有帳號就先建一個（email 已驗證），之後他用同一個 email 的 Google 帳號登入，
 * Supabase 會把 Google 身分連到這個帳號上；公開註冊是關的，所以一定要先經過這一步。
 * 可以重跑：已經是成員就只更新顯示名稱。
 */
export async function addMember(admin: SupabaseClient, input: AddMemberInput): Promise<AddMemberResult> {
  const email = normalizeEmail(input.email);
  const displayName = input.displayName.trim();
  if (!email.includes("@")) throw new Error(`email 格式不對：${input.email}`);
  if (!displayName) throw new Error("顯示名稱不能是空的");

  const workspaceId = await resolveWorkspace(admin, input.workspaceId);

  let userId = await findUserIdByEmail(admin, email);
  const createdUser = userId === null;
  if (userId === null) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      ...(input.password ? { password: input.password } : {}),
    });
    if (error) throw error;
    userId = data.user.id;
  } else if (input.password) {
    const { error } = await admin.auth.admin.updateUserById(userId, { password: input.password });
    if (error) throw error;
  }

  const { error } = await admin
    .from("workspace_members")
    .upsert({ workspace_id: workspaceId, user_id: userId, display_name: displayName }, { onConflict: "workspace_id,user_id" });
  if (error) throw error;

  return { userId, workspaceId, createdUser };
}

/**
 * 把一個人移出工作區。帳號保留（他還能登入，但只會看到「尚未加入工作區」），
 * 他的權杖在 MCP 驗證時會因為不是成員而立刻失效。回傳 false 代表他本來就不是成員。
 */
export async function removeMember(admin: SupabaseClient, input: MemberInput): Promise<boolean> {
  const workspaceId = await resolveWorkspace(admin, input.workspaceId);
  const userId = await findUserIdByEmail(admin, input.email);
  if (!userId) return false;

  const { data, error } = await admin
    .from("workspace_members")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .select("user_id");
  if (error) throw error;
  return data.length > 0;
}
