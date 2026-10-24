import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// DB 整合測試（待決-27）：RLS、trigger、MCP 的工作區過濾，接本機 Supabase 跑（先 pnpm db:start）。
// 連線資訊讀 .env.local；CI 的 migrations job 也是先 pnpm db:start 再跑 pnpm test:db。
try {
  process.loadEnvFile(".env.local");
} catch {
  // 沒有 .env.local 時由 src/test/db.ts 說明要先 pnpm db:start
}

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["src/**/*.db.test.ts"],
    // 各檔共用同一個本機資料庫與 Auth 的登入次數限制，依序跑比較穩
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 60_000,
  },
});
