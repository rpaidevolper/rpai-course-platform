import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["src/**/*.test.ts"],
    // DB 整合測試要接本機 Supabase，另外用 pnpm test:db 跑（vitest.db.config.mts）
    exclude: [...configDefaults.exclude, "src/**/*.db.test.ts"],
  },
});
