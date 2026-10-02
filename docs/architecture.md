# RPAI Course Platform 架構

## 1. 這個產品在解什麼問題

講師要準備一場課，通常得分別產出課程大綱、簡報、學員手冊，而這三樣東西本質上共用同一份 context：受眾是誰、目標是什麼、時間多長、要講哪些段落。分開做就會重複問三次、彼此不同步。

所以產品的核心不是「AI 幫你做簡報」，而是：

> 先跟 AI 把一份**教學藍圖**討論清楚，之後所有教材都從這份藍圖生成，藍圖改了下游就知道自己過期。

這條 pipeline 在 RPAI 既有的 skill 裡已經驗證過（`rpai-talk-blueprint` → `rpai-course-outline` / `rpai-course-content` / `rpai-pptx-workflow`），本專案是把它產品化成講師後台。

## 2. 兩個部分

```
┌─ 後台（Next.js，你的伺服器）────────────────┐   ┌─ 講師的電腦 ──────────────────────────┐
│ 藍圖對話（Anthropic API streaming）           │   │ Claude Code + rpai-course-platform     │
│ 抽藍圖（結構化輸出）→ blueprints 新版本       │   │   plugin                               │
│ 排產檔工作 → artifacts(status=pending)        │◄──┤ MCP：list_jobs / claim_job /           │
│ MCP server /api/mcp（權杖驗證、owner 過濾）    │   │      request_upload / complete_job     │
│ Supabase Storage 收成品、簽 URL 給講師下載     │◄──┤ 本機用 rpai-* skill 產 pptx/docx       │
└──────────────────────────────────────────────┘   └────────────────────────────────────────┘
```

產檔跑在講師自己的 Claude Code 裡：用講師自己的 Claude 訂閱、吃講師的電腦，既有 rpai-* skill 一行不用改。後台只做它擅長的事：對話、版本、佇列、檔案登記。

## 3. 資料模型

> **名詞正在改版。** 產品模組已改成「專案 → 課程 → 場次」，並新增發布、學員入口與知識庫（名詞見 `GLOSSARY.md`，取捨見 [ADR 0002](adr/0002-each-course-owns-its-blueprint.md)）。下圖仍是目前 schema 的樣子：其中的 `Course` 指「一場課」，對應新名詞的「課程」加上「場次」。schema 會等設計稿（#22）對齊後另外設計。

```
Course（一場課）
 ├─ Conversation（對話串；purpose = blueprint | outline | slides | handbook）
 │   └─ Message（Anthropic content blocks 原樣存）
 ├─ Blueprint v1, v2, v3 …（結構化 JSON，唯一真相來源）
 └─ Artifact（產物；status 是佇列狀態，每一筆綁定「基於哪一版藍圖」）
      ├─ outline  v2  ready       ← blueprint v3
      ├─ slides   v1  ready       ← blueprint v2   ← 過期：藍圖已到 v3
      └─ handbook v1  pending     ← blueprint v3   ← 等講師的 Claude Code 來認領
ApiToken（講師的 Claude Code 權杖；只存 sha256）
```

關鍵設計：

- **對話不是真相來源，藍圖才是。** 對話結束（或講師按「更新藍圖」）時，用結構化輸出把對話抽成 `Blueprint` JSON 存成新版本。之後生成任何產物都只讀藍圖。
- **藍圖版本不可變。** 修改 = 新增一版，舊版保留，產物才能可靠地指向它出生時的那一版。
- **產物不自動重生。** 藍圖升版後 UI 標示過期產物；講師決定要不要重生。
- **`artifacts` 同時是佇列。** `pending` 等認領、`generating` 有人在做（`claimed_by`、`claimed_at`）、`ready` 有檔案、`failed` 有錯誤訊息。不另外開 jobs 表。
- **五元素是 schema 的一部分。** `elements.{theory, handsOn, takeaway, quote, story}` 哪一格是空的，`missingElements()` 直接算得出來。

zod schema：`src/lib/blueprint/schema.ts`。DB schema：`supabase/migrations/`。

## 4. 產檔流程

```
講師在後台點「生成簡報」
  → artifacts 新增 (kind=slides, blueprint_id=v3, version=next, status=pending, runner=claude_code)

講師在自己的 Claude Code 說「有沒有待生成的教材」（rpai-platform-runner skill）
  → rpai_platform_list_jobs           列出 pending
  → rpai_platform_claim_job           pending→generating，回傳藍圖 JSON + 講師指示
  → 本機寫 <課程>_教學藍圖.md，跑對應的 rpai-* skill 產出 .pptx / .docx
  → rpai_platform_request_upload      拿 Supabase Storage 的 signed upload URL
  → curl PUT 上傳
  → rpai_platform_complete_job        generating→ready，記 storage_path
  （失敗 → rpai_platform_fail_job）

講師回後台下載（後台簽 download URL）
```

kind 對應：`outline` → `rpai-course-outline`（客戶版 .docx）；`slides` → `rpai-pptx-workflow`（.pptx）；`handbook` → `rpai-course-content` 展開內容後用 `docx` skill 排成學員手冊。

MCP 工具定義在 `src/lib/mcp/`，plugin 端流程在 `plugin/skills/rpai-platform-runner/SKILL.md`，兩邊的工具名與參數要同步。

## 5. 後台的 AI 呼叫

| 階段 | 用什麼 | 為什麼 |
|---|---|---|
| 藍圖對話 | Messages API streaming（`client.messages.stream`） | 即時回覆、自己掌控對話與存檔 |
| 抽藍圖 | `client.messages.parse` + `zodOutputFormat(BlueprintSchema)` | 直接拿到通過 schema 驗證的 JSON |
| 雲端後備產檔（未接線） | `client.beta.messages.stream` + `container.skills` + code execution（`src/lib/claude/generate-artifact.ts`） | 給沒有 Claude Code 的講師用；要啟用得先把 rpai-* skill 上傳成 API 自訂 skill，並補一個常駐 worker |

Prompt 組裝順序（影響快取命中）：品牌規範 + 角色設定（最穩定，加 `cache_control`）→ 藍圖 JSON（同版本內穩定）→ 該產物的指示 + 講師這次的要求（每次都變）。會變的內容永遠放最後。

## 6. 已做的決策

| 決策 | 選擇 | 理由 | 日期 |
|---|---|---|---|
| 技術棧 | Next.js 16 + TypeScript，單一 repo | 前後端一起、串流聊天順手 | 2026-09-03 |
| 資料庫 | Supabase Postgres + Storage，RLS 依 owner_id | 登入、檔案、資料庫一站解決 | 2026-09-03 |
| 模型 | `claude-opus-5`，adaptive thinking，用 effort 調深度 | 依 claude-api skill 的預設 | 2026-09-03 |
| 藍圖版本 | 不可變、只新增；產物綁定版本 | 產物才能可靠指向出生時的藍圖 | 2026-09-03 |
| **長時間產檔在哪跑** | **講師自己的 Claude Code + plugin（MCP 橋接）** | 用講師的訂閱與電腦；既有 skill 原樣可用；不踩「第三方產品不得使用訂閱登入」的政策。捨棄的選項：雲端 worker（要付 API 費、skill 要重新上傳）、Agent SDK 打包成 runner app（政策上需要 API key，還要做打包與金鑰分發） | 2026-09-03 |
| rpai-* skill 怎麼給講師 | 打包進 plugin | 講師裝一次就齊全，版本由 repo 控制 | 2026-09-03 |
| 檔案怎麼回到後台 | signed upload URL + curl，不走 MCP | pptx 幾 MB，塞進工具參數不可行 | 2026-09-03 |
| 講師身分 | 個人存取權杖（`rcp_` 開頭，只存 hash） | plugin 安裝時填一次；不用做 OAuth | 2026-09-03 |

## 7. 還沒決定的事

- **權杖管理 UI**：現在只有 `pnpm token:create`；後台要有「產生／撤銷權杖」頁。
- **講師登入**：Supabase Auth；Next.js 端要用 `@supabase/ssr` 處理 cookie session（尚未安裝）。
- **後台頁面**：對話頁、藍圖版本頁、產物列表（含過期標示與下載）都還沒做。
- **結構化輸出的 schema 相容性**：`BlueprintSchema` 用了 `min(1)`、`min(2)` 這類限制，第一次真的呼叫 `extractBlueprint()` 時要確認 API 接受；不接受就把限制移到 `checkBlueprint()` 做。
- **藍圖 JSON → `*_教學藍圖.md`** 的轉換目前交給 runner skill 現場整理；若格式飄移影響下游 skill，改成後台先產好 Markdown 一起回傳。
- **藍圖 diff UI**：v2 → v3 改了什麼要讓講師看得到。
- **多講師／團隊**：目前 schema 只有單一 owner，團隊共享要加 membership 表。
- **卡住的工作**：`generating` 超過一定時間沒完成要能退回 `pending`（講師關了 Claude Code）。

## 8. 部署架構

兩個環境：本機與 production。設計與取捨見 [`docs/specs/2026-10-02-production-deployment-design.md`](specs/2026-10-02-production-deployment-design.md)，操作見 [`docs/runbook.md`](runbook.md)。

```
開發者（Dev Container）                    GitHub                         Production
 pnpm dev ── 本機 Supabase     PR ──► CI：lint / typecheck / test / build / migrations
                                merge to main
                                   │
                                   ▼  deploy.yml（CI 通過後）
                                supabase db push ─────────────► 雲端 Supabase（production）
                                vercel build + deploy --prod ─► Vercel（Next.js app + /api/mcp）
                                smoke-test.sh ──► /api/health、/、/api/mcp
```

- 部署只由 GitHub Actions 觸發，Vercel 的 Git 自動部署關閉（`vercel.json`）。順序固定：migration 先、程式碼後，任何一步失敗就中止。
- 所以 migration 必須向下相容。
- 沒有 staging、沒有 PR preview。Production 資料庫的金鑰只在 Vercel 與 GitHub secrets，開發者不持有。
- `Dockerfile` 與 `output: "standalone"` 保留給日後搬離 Vercel，目前部署用不到。
