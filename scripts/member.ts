// 工作區成員的加入與移除（待決-3）。要用 service role，只有 owner 執行；第一位成員也用它建立。
//
//   pnpm member:add --email someone@gmail.com --name "王小明"
//   pnpm member:remove --email someone@gmail.com
//
// 選項：--workspace <id>（有多個工作區時才需要）、--password <密碼>（只限本機 Supabase，給登入頁的「本機開發用」登入）。
// 連線資訊讀 .env.local 的 NEXT_PUBLIC_SUPABASE_URL 與 SUPABASE_SERVICE_ROLE_KEY；
// 對 production 執行的方式見 docs/runbook.md「登入與成員」。
import { parseArgs } from "node:util";
import { createClient } from "@supabase/supabase-js";
import { isLocalSupabaseUrl } from "../src/lib/supabase/local.ts";
import { addMember, removeMember } from "../src/lib/workspace/members.ts";

const USAGE = `用法：
  pnpm member:add --email <email> --name <顯示名稱> [--workspace <id>] [--password <只限本機>]
  pnpm member:remove --email <email> [--workspace <id>]`;

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    email: { type: "string" },
    name: { type: "string" },
    workspace: { type: "string" },
    password: { type: "string" },
  },
});

const command = positionals[0];
if ((command !== "add" && command !== "remove") || !values.email || (command === "add" && !values.name)) {
  console.error(USAGE);
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("缺少 NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY（本機放在 .env.local）");
  process.exit(1);
}
if (values.password && !isLocalSupabaseUrl(url)) {
  console.error("--password 只能用在本機 Supabase；production 的講師一律用 Google 登入");
  process.exit(1);
}

const admin = createClient(url, key, { auth: { persistSession: false } });

try {
  if (command === "add") {
    const result = await addMember(admin, {
      email: values.email,
      displayName: values.name!,
      workspaceId: values.workspace,
      password: values.password,
    });
    console.log(
      `${result.createdUser ? "已建立帳號並" : "已"}把 ${values.email} 加進工作區 ${result.workspaceId}。` +
        `\n請他用這個 email 的 Google 帳號登入後台${values.password ? "（本機也可以用剛設的密碼登入）" : ""}。`,
    );
  } else {
    const removed = await removeMember(admin, { email: values.email, workspaceId: values.workspace });
    console.log(
      removed
        ? `已把 ${values.email} 移出工作區；他的權杖立刻失效，登入後只會看到「尚未加入工作區」。`
        : `${values.email} 本來就不是這個工作區的成員，沒有變更。`,
    );
  }
} catch (error) {
  console.error("失敗：", error instanceof Error ? error.message : error);
  process.exit(1);
}
