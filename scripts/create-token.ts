// 替講師建立一組 Claude Code 用的個人存取權杖（後台 UI 做好前的過渡工具）。
// 用法：pnpm token:create --user <auth.users.id> --label "Eddy 的 MacBook"
// 需要 .env.local 裡的 NEXT_PUBLIC_SUPABASE_URL 與 SUPABASE_SERVICE_ROLE_KEY。
import { parseArgs } from "node:util";
import { createClient } from "@supabase/supabase-js";
import { generateToken } from "../src/lib/mcp/tokens.ts";

const { values } = parseArgs({
  options: {
    user: { type: "string" },
    label: { type: "string", default: "Claude Code" },
  },
});

if (!values.user) {
  console.error("用法：pnpm token:create --user <auth.users.id> [--label 名稱]");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("缺少 NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY（放在 .env.local）");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });
const { token, hash, prefix } = generateToken();

const { error } = await supabase.from("api_tokens").insert({
  owner_id: values.user,
  label: values.label,
  token_hash: hash,
  token_prefix: prefix,
});

if (error) {
  console.error("建立失敗：", error.message);
  process.exit(1);
}

console.log(`權杖只會顯示這一次，請設定到 Claude Code plugin 的 api_token：\n\n${token}\n`);
