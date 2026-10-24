// DB 整合測試（*.db.test.ts）的共用工具。接本機 Supabase（pnpm db:start），連線資訊來自 .env.local。
// 每個測試檔各自建立工作區與帳號，email 帶亂數，結束時刪掉，不會留下資料或撞到別的檔。
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const PASSWORD = "test-password-123";

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`缺少 ${name}：先跑 pnpm db:start（會寫入 .env.local）再跑 pnpm test:db`);
  return value;
}

const CLIENT_OPTIONS = { auth: { persistSession: false, autoRefreshToken: false } };

export function adminClient(): SupabaseClient {
  return createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), CLIENT_OPTIONS);
}

/** 沒登入的訪客（anon role）。 */
export function anonClient(): SupabaseClient {
  return createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("NEXT_PUBLIC_SUPABASE_ANON_KEY"), CLIENT_OPTIONS);
}

export interface TestUser {
  id: string;
  email: string;
  /** 用這個人自己的 JWT 發請求的 client，RLS 會生效（頁面那條路）。 */
  client: SupabaseClient;
}

export interface TestCourse {
  courseId: string;
  blueprintId: string;
  conversationId: string;
  messageId: string;
  /** status = pending 的產檔工作 */
  artifactId: string;
}

/** 頁面讀資料會碰到的表，加上 0001 的 view。RLS 測試逐一檢查。 */
export const PROTECTED_TABLES = [
  "courses",
  "blueprints",
  "conversations",
  "messages",
  "artifacts",
  "api_tokens",
  "workspaces",
  "workspace_members",
  "course_latest_blueprint",
] as const;

export function dbFixture() {
  const admin = adminClient();
  const run = randomUUID().slice(0, 8);
  const userIds: string[] = [];
  const workspaceIds: string[] = [];
  const courseIds: string[] = [];
  const uniqueEmail = (label: string) => `${label}-${run}@example.test`;

  /** 不需要回傳資料的寫入：有錯就丟。 */
  async function check(promise: PromiseLike<{ error: unknown }>): Promise<void> {
    const { error } = await promise;
    if (error) throw error;
  }

  /** `.select(...).single()` 的寫入：有錯就丟，回傳那一列。 */
  async function row<T>(promise: PromiseLike<{ data: T; error: unknown }>): Promise<NonNullable<T>> {
    const { data, error } = await promise;
    if (error) throw error;
    if (data === null || data === undefined) throw new Error("查詢沒有回傳資料");
    return data;
  }

  return {
    admin,

    /** 這次執行專用、不會撞到的 email。 */
    email: uniqueEmail,

    /** 測試裡由受測程式建立的帳號，登記起來讓 cleanup 一起刪。 */
    trackUser(id: string): void {
      userIds.push(id);
    },

    async workspace(name: string): Promise<string> {
      const workspace = await row(admin.from("workspaces").insert({ name: `${name}-${run}` }).select("id").single());
      workspaceIds.push(workspace.id);
      return workspace.id as string;
    },

    /** 建一個能用密碼登入的帳號；給 workspaceId 就順便加成成員。 */
    async user(label: string, workspaceId?: string): Promise<TestUser> {
      const email = uniqueEmail(label);
      const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
      if (error) throw error;
      userIds.push(data.user.id);
      if (workspaceId) {
        await check(
          admin.from("workspace_members").insert({ workspace_id: workspaceId, user_id: data.user.id, display_name: label }),
        );
      }
      const client = anonClient();
      const signIn = await client.auth.signInWithPassword({ email, password: PASSWORD });
      if (signIn.error) throw signIn.error;
      return { id: data.user.id, email, client };
    },

    /** 用 service role 建一門課（像部署空窗裡的舊程式，不帶 workspace_id），連同藍圖、對話、訊息與一筆 pending 工作。 */
    async course(ownerId: string, title: string): Promise<TestCourse> {
      const course = await row(admin.from("courses").insert({ owner_id: ownerId, title }).select("id").single());
      courseIds.push(course.id);
      const blueprint = await row(
        admin.from("blueprints").insert({ course_id: course.id, version: 1, content: { title } }).select("id").single(),
      );
      const conversation = await row(admin.from("conversations").insert({ course_id: course.id }).select("id").single());
      const message = await row(
        admin
          .from("messages")
          .insert({ conversation_id: conversation.id, role: "user", content: [{ type: "text", text: title }] })
          .select("id")
          .single(),
      );
      const artifact = await row(
        admin
          .from("artifacts")
          .insert({ course_id: course.id, blueprint_id: blueprint.id, kind: "slides", version: 1 })
          .select("id")
          .single(),
      );
      return {
        courseId: course.id,
        blueprintId: blueprint.id,
        conversationId: conversation.id,
        messageId: message.id,
        artifactId: artifact.id,
      };
    },

    async cleanup(): Promise<void> {
      // artifacts → blueprints 是 on delete restrict，先刪產物，課程與其餘子表再隨帳號一起 cascade
      if (courseIds.length) await check(admin.from("artifacts").delete().in("course_id", courseIds));
      if (courseIds.length) await check(admin.from("courses").delete().in("id", courseIds));
      for (const id of userIds) await admin.auth.admin.deleteUser(id);
      if (workspaceIds.length) await check(admin.from("workspaces").delete().in("id", workspaceIds));
    },
  };
}
