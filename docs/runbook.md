# Production 維運手冊

環境與部署的設計見 [`specs/2026-10-02-production-deployment-design.md`](specs/2026-10-02-production-deployment-design.md)。

## 一眼看懂現況

- 服務是否正常：`curl <PRODUCTION_URL>/api/health`，預期 `{"status":"ok","database":"ok","commit":"<sha>"}`。
- 上一次部署：GitHub → Actions → **Deploy**。
- 線上跑的是哪個 commit：`/api/health` 的 `commit`。

## 部署

合併到 `main` 後自動執行。順序固定：CI 通過 → 套用 migration → 部署 Vercel → smoke test。任何一步失敗就中止。

**手動重跑**（例如 secrets 補齊後、或暫時性失敗）：

```bash
gh workflow run deploy.yml --ref main
```

只允許在 `main` 上手動觸發。環境剛建好時的第一次部署由 `scripts/setup-production.sh` 完成（bootstrap），之後都是合併到 `main` 自動部署。

## 回滾

### 程式碼壞了（migration 沒問題）

最快：Vercel Dashboard → 專案 → Deployments → 挑上一個正常的部署 → **Instant Rollback**。秒級生效，不需要重新 build。

之後在 `main` 上 revert 壞掉的 commit，走一般 PR 流程修正。

**注意**：Instant Rollback 之後，Vercel 會暫停「自動把新部署指派到 production 網域」。修好的部署照常 build，但不會自動上線，Deploy 的 smoke test 會因為 commit 不符而失敗。修好後到 Vercel → Deployments 對新的部署按 **Promote**（或在 Settings → Domains 重新開啟自動指派），再手動重跑 Deploy。

### Migration 壞了

Migration **只往前，不做 down**。要撤回就寫一個新的修正 migration（`supabase/migrations/NNNN_*.sql`）走 PR 合併。

若 migration 已套用到一半（`db push` 中途失敗）：

1. 到 Supabase Dashboard → SQL Editor 看目前的 schema 狀態，以及 `supabase_migrations.schema_migrations` 記錄了哪些版本。
2. 修正後在 `main` 上重跑 Deploy。`db push` 只會套用尚未記錄的 migration。

### 資料誤刪或損毀

Supabase 免費方案沒有自動備份。有資料要保護的話，需要 owner 升級到有每日備份（或 PITR）的方案；還原在 Supabase Dashboard → Database → Backups。

破壞性的 migration（刪欄位、刪表、改型別）合併前，請 owner 先手動備份：

```bash
pnpm exec supabase db dump --linked --password "$SUPABASE_DB_PASSWORD" -f backup-$(date +%F).sql
```

## 故障排除

| 症狀 | 看哪裡 | 常見原因與處理 |
|---|---|---|
| Deploy 在 `Check required secrets` 失敗 | 錯誤訊息列出缺的名稱 | 環境還沒建好或 secret 被刪。owner 執行 `scripts/setup-production.sh` |
| `supabase link` / `db push` 失敗，訊息提到 auth 或 password | Deploy 紀錄 | `SUPABASE_ACCESS_TOKEN` 過期，或資料庫密碼被重設。重新產生後 `gh secret set` |
| `db push` 失敗，訊息是 SQL 錯誤 | Deploy 紀錄 | Migration 有問題但 CI 的 `migrations` job 沒抓到（多半是跟真實資料互動的錯誤）。見上方「Migration 壞了」 |
| `vercel pull` / `build` / `deploy` 失敗 | Deploy 紀錄 | `VERCEL_TOKEN` 過期、專案 ID 錯誤，或 Vercel 環境變數缺漏導致 build 失敗 |
| Smoke test 失敗：`/api/health` 一直不是 `database ok` | Vercel → Logs | Vercel 上 `SUPABASE_SERVICE_ROLE_KEY` 或 `NEXT_PUBLIC_SUPABASE_URL` 錯誤，或 Supabase 專案暫停（免費方案閒置會暫停） |
| Smoke test 失敗：commit 不符 | Deploy 紀錄 | 別名還沒切換（腳本會重試約兩分鐘）；或 `PRODUCTION_URL` 指到別的網域 |
| Smoke test 失敗：`/api/mcp` 沒回 401 | Vercel → Logs | MCP 路由或權杖驗證壞了，這是真正的問題，先回滾 |
| 前端連到錯的 Supabase | — | `NEXT_PUBLIC_*` 是 build 時寫入的。改了 Vercel 環境變數之後要重新部署，不是重啟 |

## 輪替金鑰

| 要換什麼 | 怎麼換 |
|---|---|
| Supabase service role / anon key | Supabase Dashboard 重新產生 → `vercel env add <NAME> production --force` → 重新部署 |
| 資料庫密碼 | Supabase Dashboard → Settings → Database 重設 → `gh secret set SUPABASE_DB_PASSWORD` |
| Supabase access token / Vercel token | 在各自 Dashboard 重新產生 → `gh secret set` |
| Anthropic API key | Console 重新產生 → `vercel env add ANTHROPIC_API_KEY production --force` → 重新部署 |

這些都需要 owner 帳號。環境變數與 secrets 都不要貼到 issue、PR 或聊天。
