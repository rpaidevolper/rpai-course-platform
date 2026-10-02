# RPAI Course Platform — 產品規格（v0.1）

> 狀態：草案，對應 2026-09-03 的討論。架構與決策理由在 `docs/architecture.md`，本文只講「要做出什麼、怎樣算做完」。

## 1. 背景與目標

講師準備一場課要產出課程大綱、簡報、學員手冊三樣東西，它們共用同一份前提（受眾、目標、時間、段落），但現況是分開做、重複問、彼此不同步。

目標：講師先跟 AI 談出一份**教學藍圖**，之後所有教材都從同一份藍圖生成；藍圖改了，下游教材知道自己過期。

成功的樣子：講師開一門課 → 對話 15 分鐘 → 藍圖完整（五元素齊全）→ 按三個按鈕 → 在自己的 Claude Code 跑一輪 → 回後台下載三份檔案。整個過程受眾與目標只被問一次。

## 2. 名詞

| 名詞 | 定義 |
|---|---|
| 課程 Course | 一場講座或課程，講師建立，一個 owner |
| 教學藍圖 Blueprint | 結構化 JSON，課程的唯一真相來源；有版本號，版本不可變 |
| 五元素 | 理論／動手／帶走／金句／故事，藍圖 schema 的一部分 |
| 產物 Artifact | 從某一版藍圖生成的檔案：`outline`（課程大綱 .docx）、`slides`（簡報 .pptx）、`handbook`（學員手冊 .docx） |
| 工作 Job | `artifacts` 表中 `status = pending` 的一列；被講師的 Claude Code 認領後產檔 |
| 過期 Stale | 產物綁定的藍圖版本不是課程最新版 |
| 權杖 Token | 講師在後台產生、設定到 Claude Code plugin 的個人存取權杖（`rcp_` 開頭） |
| Runner | 實際產檔的一方；MVP 只有 `claude_code`（講師自己的 Claude Code），`cloud` 保留 |

## 3. 範圍

### MVP 包含

1. 講師登入（Supabase Auth，email）
2. 建立課程、與 AI 對話談藍圖（串流）
3. 從對話抽出藍圖、存成新版本；顯示五元素完整性與待確認事項
4. 排產檔工作（三種產物）、顯示狀態與過期標示、下載成品
5. MCP server（`/api/mcp`）與權杖管理（產生、撤銷）
6. Claude Code plugin：拉工作、產檔、上傳
7. 藍圖對話的 prompt 快取（品牌規範與藍圖放前段）

### MVP 不包含

- 雲端產檔（沒有 Claude Code 的講師）——程式碼保留，未接線
- 多講師共用一門課、團隊、權限層級
- 藍圖 diff 檢視
- 在後台直接編輯藍圖欄位（只能透過對話升版）
- 產物預覽（只提供下載）
- 自動重生過期產物

## 4. 使用情境與驗收條件

### U1 建立課程並談出藍圖

講師建立課程後進入對話頁，AI 以教練方式一次問一題（受眾 → 離場能做什麼 → 時間與形式 → 五元素 → 敘事）。

驗收：
- 對話逐字串流顯示；重新整理頁面後歷史仍在。
- 講師說「差不多了」或按「更新藍圖」後，系統產生藍圖 v1，並顯示：標題、受眾、學習成果、五元素每格的內容、單元表、待確認事項。
- 五元素有空格時，該格明顯標示「缺」；每個時段的單元分鐘加總與時段長度不符時提示差多少；純講述單元（沒有動手環節）標出來。
- 藍圖 JSON 通過 `BlueprintSchema` 驗證才存；驗證失敗時顯示錯誤並保留對話，不寫入。

### U2 修改藍圖（升版）

講師繼續對話說「受眾改成主管」，再按「更新藍圖」。

驗收：
- 產生 v2；v1 仍可查看。
- 所有綁定 v1 的產物立即標示「已過期（基於 v1，目前 v2）」。
- 不會自動重新產檔。

### U3 排產檔工作

講師在課程頁按「生成簡報」，可填一句額外要求（例如「壓在 20 頁內」）。

驗收：
- 新增 `artifacts` 一列：`kind=slides`、`blueprint_id=最新版`、`version=該 kind 的下一號`、`status=pending`、`runner=claude_code`、`meta.instructions=額外要求`。
- 同一 kind 已有 `pending` 或 `generating` 時，按鈕停用並說明「上一份還在做」。
- 藍圖有待確認事項時，按鈕可按，但顯示警告「藍圖有 N 項待確認」。

### U4 在 Claude Code 產檔

講師在自己的 Claude Code 說「有沒有待生成的教材」。

驗收（plugin 端）：
- 列出所有 pending 工作（課程、產物、藍圖版本、排入時間）；沒有就明說。
- 認領後在本機寫 `rpai-platform/<course_id>/blueprint.v<N>.json` 與 `<課程>_教學藍圖.md`。
- 藍圖有待確認事項時先列出來問，不自行補答案。
- 依 kind 用對應 skill 產檔，不重問藍圖已有的資訊；講師的 `instructions` 優先於 skill 預設。
- 上傳成功後呼叫 `complete_job`；任何失敗呼叫 `fail_job` 並附原因。
- 全程不印出權杖。

驗收（後台端）：
- 認領是原子的：兩台機器同時認領同一筆，只有一台成功。
- `complete_job` 會確認 Storage 裡檔案存在才標 `ready`。
- 課程頁上該產物狀態從 pending → generating（顯示 `claimed_by`）→ ready，重新整理即可看到。

### U5 下載產物

驗收：
- `ready` 的產物有下載按鈕，走 signed download URL（有效 10 分鐘），檔名還原成上傳時的名稱。
- 過期產物仍可下載，但標示過期。
- `failed` 的產物顯示錯誤訊息與「重新排入」按鈕（建立新的一列，版本 +1）。

### U6 權杖管理

驗收：
- 設定頁可產生權杖（需填標籤）；明文只顯示一次。
- 列表顯示標籤、前綴、建立時間、最後使用時間；可撤銷。
- 撤銷後該權杖的 MCP 請求回 401。
- 未有 UI 之前，`pnpm token:create` 可替代。

## 5. 功能需求

### F1 對話（後台）

- 模型 `claude-opus-5`，adaptive thinking，`client.messages.stream`。
- System prompt 順序：教練角色設定（固定，`cache_control`）→ 目前最新藍圖 JSON（若有，`cache_control`）。
- 對話紀錄以 Anthropic content blocks 原樣存 `messages.content`，送回 API 時不重組。
- 一門課的藍圖對話只有一個 conversation（`purpose=blueprint`）。

### F2 抽藍圖

- `client.messages.parse` + `zodOutputFormat(BlueprintSchema)`；`parsed_output` 為 null 視為失敗。
- 新版本號 = 該課程目前最大版本 + 1；`change_note` 由講師選填。
- 抽取結果先給講師看摘要再存（避免一句話誤觸升版）。

### F3 工作佇列

狀態機：`pending → generating → ready | failed`；`failed → （重新排入）新列 pending`。

- `pending` 只能被 `claim_job` 改成 `generating`（條件式 update）。
- `generating` 超過 6 小時未完成，後台顯示「可能卡住」並提供「退回 pending」按鈕（MVP 用手動，不做排程）。

### F4 MCP server

- 路徑 `/api/mcp`，無狀態 Streamable HTTP，`mcp-handler` + MCP SDK v2。
- 驗證：`Authorization: Bearer rcp_…`，比對 `api_tokens.token_hash`，`revoked_at` 為 null；成功更新 `last_used_at`。
- 所有工具以權杖對應的 `owner_id` 過濾；使用 service role client，**不依賴 RLS**。
- 工具契約見第 7 節。

### F5 Plugin

- 位置 `plugin/`，marketplace 為 repo 根目錄 `.claude-plugin/marketplace.json`（名稱 `rpai`）。
- 安裝時詢問 `server_url`、`api_token`（sensitive）。
- 內含 `rpai-platform-runner`（流程）與五個 rpai-* 內容 skill；`pptx`、`docx` 用 Claude Code 內建。
- 工具名或參數變更時，`rpai-platform-runner/SKILL.md` 同步更新（同一個 PR）。

### F6 產物儲存

- Bucket `artifacts`（私有）。路徑 `owner_id/course_id/artifact_id/檔名`。
- 上傳：`createSignedUploadUrl`（`upsert: true`），plugin 用 curl PUT。
- 下載：`createSignedUrl`，10 分鐘。
- 只接受 `.pptx`、`.docx`、`.pdf`、`.md`。

## 6. 資料模型

已落在 `supabase/migrations/0001_init.sql`、`0002_local_runner.sql`：

| 表 | 用途 | 關鍵欄位 |
|---|---|---|
| `courses` | 課程 | `owner_id` |
| `blueprints` | 藍圖版本（不可變） | `course_id`、`version`（唯一）、`content` jsonb、`change_note` |
| `conversations` / `messages` | 對話 | `purpose`、`content` jsonb（content blocks） |
| `artifacts` | 產物＋佇列 | `blueprint_id`、`kind`、`version`、`status`、`runner`、`claimed_by/at`、`storage_path`、`filename`、`error`、`meta.instructions` |
| `api_tokens` | 講師權杖 | `token_hash`（唯一）、`token_prefix`、`revoked_at`、`last_used_at` |

過期判定：`artifact.blueprint_id ≠ course_latest_blueprint.id`（view 已建）。

藍圖 JSON 結構：`src/lib/blueprint/schema.ts`（`title`、`oneLiner`、`audience`、`outcomes`、`format`、`narrative`、`elements`、`days`（天 → 時段 → 單元；總時長由各時段加總）、`constraints`、`openQuestions`）。

## 7. MCP 工具契約

前綴 `rpai_platform_`。回傳皆為 JSON（`structuredContent`），錯誤以 `isError` 回文字說明並指出下一步。

| 工具 | 輸入 | 輸出 | 錯誤情境 |
|---|---|---|---|
| `list_courses` | — | `{count, courses[{id,title,updated_at}]}` | — |
| `get_blueprint` | `course_id`、`version?` | `{id, version, content, change_note, created_at}` | 課程不屬於你／版本不存在 |
| `list_jobs` | — | `{count, jobs[{id, kind, kind_label, version, created_at, course{id,title}, blueprint_version, instructions}]}` | — |
| `claim_job` | `job_id`、`claimed_by` | job 摘要 + `blueprint`（完整 JSON） | 不存在／不屬於你／已被認領 |
| `request_upload` | `job_id`、`filename` | `{upload_url, storage_path, content_type, expires_in_seconds}` | 副檔名不允許／未認領 |
| `complete_job` | `job_id`、`storage_path` | `{job_id, status:"ready", storage_path}` | 不存在／Storage 沒有檔案 |
| `fail_job` | `job_id`、`error` | `{job_id, status:"failed"}` | 不存在 |

實作：`src/lib/mcp/tools.ts`、`src/lib/mcp/store.ts`。

## 8. 非功能需求

- **隔離**：任何講師只能碰到自己的課程、藍圖、產物、權杖；MCP 與頁面兩條路徑都要有測試覆蓋跨 owner 存取回 404/401。
- **權杖**：明文不落地、不寫 log；DB 只存 sha256；撤銷即時生效。
- **成本**：藍圖對話的 `cache_read_input_tokens` 在第二輪起應大於 0（品牌規範與藍圖在前段）。
- **可觀測**：MCP 每次工具呼叫記錄 owner、工具名、耗時、成功與否（不記參數內容）。
- **品質門檻**：`pnpm lint && pnpm typecheck && pnpm test` 全綠才能合併。

## 9. 端到端驗收腳本

1. 以測試帳號登入，建立課程「用 AI 工具把週報時間砍一半」。
2. 對話 8 輪後按「更新藍圖」→ 出現 v1，五元素全齊，待確認 0 項。
3. 按「生成簡報」→ 課程頁顯示 slides v1 pending。
4. 設定頁產生權杖，安裝 plugin（`claude --plugin-dir ./plugin` 或 marketplace）。
5. 在 Claude Code 說「有沒有待生成的教材」→ 認領 → 產出 .pptx → 上傳 → 回報完成。
6. 後台重新整理：slides v1 ready，可下載，開檔正常。
7. 對話說「受眾改成主管」→ 更新藍圖 → v2；slides v1 標示過期。
8. 撤銷權杖 → Claude Code 再呼叫任何工具回 401。

## 10. 未決事項

| 事項 | 影響 | 建議 |
|---|---|---|
| 結構化輸出是否接受 `min(1)`/`min(2)` 這類限制 | F2 | 第一次串接時實測；不行就把限制移到 `checkBlueprint()` |
| 藍圖 JSON → `*_教學藍圖.md` 由誰轉 | U4 | MVP 交給 runner skill；格式飄移再改成後台產好 Markdown |
| 卡住的 `generating` 是否自動退回 | F3 | MVP 手動；之後加排程 |
| 訂閱方案的 Agent SDK credit 是否涵蓋第三方 app | 是否值得做 runner app | 待確認 help center 文章；不影響 MVP |
| 團隊共享 | 資料模型 | 之後加 membership 表 |

## 11. 里程碑

| 里程碑 | 內容 | 完成定義 |
|---|---|---|
| M0（已完成） | 骨架、schema、migration、MCP server、plugin、文件 | lint/typecheck/test 全綠，已推分支 |
| M1 | 登入、權杖 UI、課程列表 | U6 通過；MCP 用真實權杖打通 `list_jobs` |
| M2 | 對話頁、抽藍圖、版本與完整性顯示 | U1、U2 通過 |
| M3 | 排工作、狀態、下載、過期 | U3、U5 通過；端到端腳本 1–8 全過 |
| M4 | 打磨：卡住工作處理、觀測、plugin 發佈到 main | 講師群可自行安裝使用 |
