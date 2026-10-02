# 正式環境與自動部署設計

日期：2026-10-02
狀態：實作中（issue #13）

## 目標

建立一個正式環境，讓前端、後端（含 `/api/mcp`）、資料庫與 Storage 都確認能運作；共同開發者 clone 後可以馬上接手；PR 合併到 `main` 後自動部署，不需要人手動操作。

## 前提與決定

| 決定 | 選擇 | 理由 |
|---|---|---|
| 部署平台 | Vercel | Next.js 原生支援，設定最少 |
| 環境 | 本機 + Production 兩種 | 現階段不需要 staging；之後要加只需多一個 Supabase 專案與一個部署目標 |
| PR preview | 不啟用 | preview 一定要連資料庫，沒有 staging 就不能讓未合併的程式碼碰正式資料 |
| 開發用資料庫 | 每人本機 Supabase（Dev Container 內建） | 互不干擾、可隨時 `db:reset`；不必發 service role key 給每位開發者 |
| 雲端資料庫 | 1 個 Supabase 專案，只有 production | 開發者預設不拿它的 key |
| 誰負責部署 | GitHub Actions 驅動，不用 Vercel 的 Git 整合 | 要控制順序：CI 通過 → migration → 部署；migration 失敗就不上線 |

「所有人共用同一個 DB」不採用，原因：migration 規則是只新增不改舊檔，兩人同時開同編號的 migration 或某人套到一半失敗會讓所有人一起壞；資料依 `owner_id` 隔離，共用會互相污染；且得把繞過 RLS 的 service role key 發給每個人。

## 環境

| 環境 | 前後端 | 資料庫 | 觸發 |
|---|---|---|---|
| 本機 | Dev Container（`pnpm dev`） | 本機 Supabase（`pnpm db:start`） | 手動 |
| Production | Vercel production | 雲端 Supabase 專案 | 合併到 `main` |

## 流程

### PR 階段（`ci.yml`）

現有的 `lint`、`typecheck`、`test`、`build` 之外，新增 `migrations` job：在 runner 上啟動全新的本機 Supabase，從頭套用 `supabase/migrations/` 全部檔案，並檢查 schema 的基本事實（`courses` 表可查、`artifacts` bucket 存在）。壞掉的 SQL 在 PR 階段就被擋下。

`migrations` 不加入 `main` ruleset 的 required checks（避免這次改動需要 owner 先動 ruleset）；日後由 owner 執行 `scripts/setup-github.sh` 時再加入。

### 合併後（`deploy.yml`）

觸發：`workflow_run`，等 `main` 上的 `CI` workflow 成功；也提供 `workflow_dispatch` 手動重跑。使用 `concurrency` 讓同時間只有一個部署，且不取消進行中的部署。

1. `supabase link` + `supabase db push`：把尚未套用的 migration 套到 production。
2. `vercel pull` → `vercel build --prod` → `vercel deploy --prebuilt --prod`，輸出部署網址。
3. Smoke test（`scripts/smoke-test.sh <url>`），失敗就讓 workflow 標紅：
   - `GET /api/health` 回 200 且 `database` 為 `ok`
   - `GET /` 回 200
   - `POST /api/mcp` 未帶權杖回 401（證明 MCP 路由活著且有驗證）

任何一步失敗就中止後續步驟。

### Health check

`GET /api/health` 回 JSON：`{ status, database, commit }`。`database` 用 service role client 查一次 `courses`（`select id limit 1`）判斷。資料庫不通時回 503。不洩漏錯誤細節與任何金鑰。`commit` 取部署時由 workflow 以 `-e APP_COMMIT_SHA=$GITHUB_SHA` 注入的環境變數，沒有則為 `null`；smoke test 用它確認線上跑的就是剛部署的 commit。Smoke test 打 production 網址（repo variable `PRODUCTION_URL`），不打單次部署的唯一網址，因為後者預設受 Vercel 保護。

## 設定與密碼

GitHub repo secrets（owner 設定）：

| Secret | 用途 |
|---|---|
| `VERCEL_TOKEN` | Vercel CLI |
| `VERCEL_ORG_ID`、`VERCEL_PROJECT_ID` | 指定 Vercel 專案 |
| `SUPABASE_ACCESS_TOKEN` | Supabase CLI |
| `SUPABASE_PROJECT_REF` | production 專案識別 |
| `SUPABASE_DB_PASSWORD` | `db push` 連線 |

Repo variable（非機密）：`PRODUCTION_URL`，smoke test 的目標網址。

Vercel Production 環境變數（用 `vercel env add`，不進 repo）：`ANTHROPIC_API_KEY`、`NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY`。

`NEXT_PUBLIC_*` 在 build 時寫入前端 bundle，所以 `vercel build` 前必須先 `vercel pull` 取得它們。

人工步驟由 `scripts/setup-production.sh`（wizard）引導：登入 Vercel 與 Supabase、建立專案、設定上述 secrets 與環境變數。

## 其他改動

- `vercel.json`：關閉 Vercel 的 Git 自動部署，只允許 Actions 部署。
- `README`：新增「環境與部署」；Owner 維運補上 production 相關。
- `docs/architecture.md`：新增部署架構一節。
- `docs/runbook.md`：回滾、手動重跑部署、常見故障。
- `CLAUDE.md`：資料規範新增「migration 必須向下相容」，因為順序是先 migrate、再部署。
- 既有 `Dockerfile` 與 `output: "standalone"` 不動，Vercel 不使用，保留給日後搬平台。

## 取捨與風險

- **沒有 staging，production 是第一個真實環境。** `migrations` job 抓得到語法與套用錯誤，抓不到真實資料上的效果。有破壞性的 migration 要在 PR 說明標明，並先備份。
- **Migration 必須向下相容**：先加欄位，下一版才移除舊欄位。因為 migration 先於程式碼上線，舊版程式碼會短暫面對新 schema。
- **Supabase 免費方案沒有自動備份。** 真實講師資料進來之前建議升級到有每日備份的方案；這是 owner 的決定，runbook 只標出風險。
- **回滾**：程式碼用 Vercel Instant Rollback；migration 只往前，不做 down，要撤回就寫一個新的修正 migration。
- **`workflow_run` 只在預設分支的 workflow 檔上執行**：`deploy.yml` 合併到 `main` 後才會生效，第一次部署由 `workflow_dispatch` 觸發。

## 不在範圍內

staging、PR preview、自訂網域、監控與告警、藍綠部署、Supabase Auth 的 redirect URL 與 SMTP 設定（等登入功能實作時再處理）。

## 驗收

見 issue #13。最終驗收：production 網址的 `/api/health` 回 200，且 `main` 上新增一個 commit 會自動走完 deploy workflow。
