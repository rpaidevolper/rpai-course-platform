// 把知識庫資料夾同步進平台（#134）。用法：pnpm kb:sync <資料夾> [--aliases <別名檔>] [--apply]
// 不加 --apply 只試跑、印報告，不寫入。需要 .env.local 裡的 NEXT_PUBLIC_SUPABASE_URL 與 SUPABASE_SERVICE_ROLE_KEY。
// 報告只含檔名與數量，不印出客戶名稱；別名檔與資料夾都不進 repo。
import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { createClient } from "@supabase/supabase-js";
import { readMarkdownFiles } from "../src/lib/knowledge/folder.ts";
import { createMemorySyncStore, createSupabaseSyncStore, type SyncStore } from "../src/lib/knowledge/store.ts";
import { runSync } from "../src/lib/knowledge/sync.ts";

const USAGE = "用法：pnpm kb:sync <資料夾> [--aliases <別名檔>] [--apply]";

function parseCli() {
  try {
    return parseArgs({
      allowPositionals: true,
      options: {
        aliases: { type: "string" },
        apply: { type: "boolean", default: false },
      },
    });
  } catch {
    console.error(USAGE);
    process.exit(1);
  }
}

const { values, positionals } = parseCli();

const [folder] = positionals;
if (positionals.length !== 1 || !folder) {
  console.error(USAGE);
  process.exit(1);
}

async function main(): Promise<void> {
  const apply = values.apply === true;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  let store: SyncStore;
  if (url && key) {
    store = createSupabaseSyncStore(createClient(url, key, { auth: { persistSession: false } }));
  } else {
    if (apply) {
      console.error("--apply 需要 .env.local 裡的 NEXT_PUBLIC_SUPABASE_URL 與 SUPABASE_SERVICE_ROLE_KEY");
      process.exit(1);
    }
    console.log("沒有 Supabase 連線設定，比對時當作平台是空的");
    store = createMemorySyncStore();
  }

  const files = await readMarkdownFiles(folder);
  const aliasesText = values.aliases ? await readFile(values.aliases, "utf8") : null;

  const result = await runSync({ files, aliasesText, apply, store, now: new Date(), log: (line) => console.log(line) });
  if (!result.ok) process.exit(1);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
