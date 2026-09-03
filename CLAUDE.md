# CLAUDE.md

@AGENTS.md

本檔定義本專案的 skill 分工規則與技術規範。分工規則的目的是避免「同名／同職責」的 skill 互相搶觸發，
導致每次都要重猜該用哪一套。

## 已安裝的 skill 來源

- **帳號層 RPAI 系列**（`rpai-*`、`grilling`、`care-record-quality-check` 等）
  —— 內容生產用：講座、課程、簡報、社群貼文、提案。
- **mattpocock-skills plugin**（marketplace: `mattpocock`）
  —— 軟體工程用：需求釐清、規格、TDD、除錯、架構、程式碼審查。
- **本 repo 的 `plugin/`**（marketplace: `rpai`）
  —— 給講師裝在自己 Claude Code 裡的產檔 plugin；打包了五個 `rpai-*` 內容 skill 與串流程的 `rpai-platform-runner`。
  在這個 repo 裡開發時它**不會自動載入**，要測試用 `claude --plugin-dir ./plugin`。

安裝方式（供日後重建環境參考）：

```bash
claude plugin marketplace add mattpocock/skills
claude plugin install mattpocock-skills@mattpocock
```

## 分工規則

### 1. 「拷問／釐清需求」——看產出物決定

兩邊都有名為 `grilling` 的 skill，且**都會被模型自動觸發**，這是最容易撞的一組。

| 情境 | 用哪個 |
|---|---|
| 要規劃講座／課程／簡報／提案等**內容交付物** | 帳號層的 `rpai-talk-blueprint`（其內部會用帳號層 `grilling`） |
| 要釐清**軟體功能需求／技術設計** | `/grill-with-docs`（會順帶產出 ADR 與 glossary） |
| 只是想單純被電一頓、壓力測試某個想法 | `/grill-me` |

判準：**產出物是投影片或文章 → RPAI 鏈；產出物是程式碼或 spec → mattpocock 鏈。**

### 2. 「程式碼審查」——看要審什麼

同樣有兩個 `code-review`，且都會自動觸發。

- **內建 `/code-review`**：抓 correctness bug、可簡化處、效率問題。日常改動預設用這個。
- **mattpocock `code-review`**：以「本 repo 的 coding standards」與「原始 issue/spec」兩軸並行審查。
  **有寫下 spec 或 ticket 的工作**完成後用這個，才能驗收「有沒有照規格做」。

規則：**沒有 spec 就用內建版；有 spec 就用 mattpocock 版。**

### 3. 軟體工程流程——預設走 mattpocock 鏈

需求 → 規格 → 工單 → 實作 → 審查：

```
/grill-with-docs  →  /to-spec  →  /to-tickets  →  /implement (內部走 tdd)  →  /code-review
```

- 工作量大到一個 session 裝不下時，先用 `/wayfinder` 畫決策地圖。
- 修 bug 走 `diagnosing-bugs`，不要直接猜。
- 動模組介面／切分層時，用 `codebase-design` 的詞彙（deep module、seam），不要自創「service」「component」等說法。
- merge / rebase 衝突走 `resolving-merge-conflicts`，一律解完，不要 `--abort`。

`/to-spec`、`/to-tickets`、`triage` 需要先設定 issue tracker。第一次使用前跑 `/setup-matt-pocock-skills`。

### 4. 內容生產流程——維持原有 RPAI 鏈，不要換

```
rpai-talk-blueprint  →  rpai-course-outline / rpai-course-content  →  rpai-pptx-workflow / rpai-proposal
```

`rpai-talk-blueprint` 是這條鏈的唯一上游真相來源。**不要**用 `/grill-with-docs` 取代它——
那會產出 ADR 與領域模型，不是教學藍圖，下游 skill 讀不到需要的欄位。

品牌規範一律先讀 `rpai-brand-guidelines`。

## 專案

**rpai-course-platform** —— 講師用的教材準備後台。

核心機制是**藍圖續用**：講師先與 AI 對話，談出一份課程藍圖（受眾、教學目標、核心訊息、
五元素完整性：理論／動手／帶走／金句／故事）。這份藍圖是整場課程的**唯一 context 來源**，
下游所有產出都讀它，不再重複詢問前提。

由同一份藍圖衍生的產出：

- 課程架構（單元切分、時間配置、流程）
- 簡報（.pptx）
- 學員手冊

設計上的關鍵判斷：這三者不是三個獨立功能，而是**同一份 context 的三種投影**。
任何讓它們各自持有前提的做法都是錯的——藍圖改動必須能傳播到所有下游產出。

概念上游對應帳號層的 `rpai-talk-blueprint` skill 鏈；本專案是把那條鏈產品化成有後台的系統。

### 核心原則（動任何功能前先讀）

1. **藍圖是唯一真相來源。** 對話只是產生／修改藍圖的手段；所有生成一律讀 `Blueprint`，不讀對話紀錄。
2. **藍圖有版本，產物綁版本。** `artifacts.blueprint_id` 指向產生它的那一版；藍圖升版不會自動重生產物，UI 顯示「已過期」讓講師決定。
3. **五元素完整性**是藍圖 schema 的一部分，缺哪格 UI 要看得到。
4. **產檔在講師自己的 Claude Code 裡跑。** 後台只排工作、收檔案；plugin 透過 MCP 拉藍圖、用 rpai-* skill 產檔、上傳成品。後台不自己跑 python-pptx。

完整設計與決策記錄見 `docs/architecture.md`。

### 技術棧

- Next.js 16（App Router、`src/` 目錄）+ TypeScript strict + Tailwind v4
- Anthropic TypeScript SDK `@anthropic-ai/sdk`，模型 `claude-opus-5`（後台的藍圖對話與抽藍圖）
- MCP server：`mcp-handler` + `@modelcontextprotocol/server` v2，掛在 `src/app/api/mcp/route.ts`
- Supabase（Postgres + Auth + Storage），schema 在 `supabase/migrations/`
- zod v4（藍圖 schema、結構化輸出、MCP 工具輸入）、vitest

### 常用指令

| 目的 | 指令 |
|---|---|
| 安裝 | `pnpm install` |
| 開發 | `pnpm dev` |
| Lint | `pnpm lint` |
| 型別檢查 | `pnpm typecheck`（會先跑 `next typegen` 產生 Next.js 的全域型別） |
| 測試 | `pnpm test`（單檔：`pnpm test src/lib/blueprint/schema.test.ts`） |
| Build | `pnpm build` |
| 建講師權杖 | `pnpm token:create --user <auth.users.id> --label 名稱` |
| 測 plugin | `claude --plugin-dir ./plugin` |

提交前必跑 `pnpm lint && pnpm typecheck && pnpm test`。套件管理一律用 pnpm。

### 目錄

```
src/app/              Next.js 路由（頁面、API route；/api/mcp 是 MCP server）
src/lib/blueprint/    藍圖 schema 與完整性檢查（純函式，可單測）
src/lib/claude/       所有 Anthropic API 呼叫集中在這裡
src/lib/mcp/          MCP 工具、權杖驗證、工作佇列存取
src/lib/supabase/     Supabase client
supabase/migrations/  SQL migration，只新增不改舊檔
plugin/               講師端 Claude Code plugin（.mcp.json、runner skill、打包的 rpai-* skill）
.claude-plugin/       marketplace.json，讓 `claude plugin marketplace add rpaidevolper/rpai-course-platform` 找得到 plugin
scripts/              一次性維運腳本
docs/                 架構與決策記錄
```

### Claude API 規範

動任何 `src/lib/claude/` 程式前，先載入 `claude-api` skill 確認 API 形狀，不要憑記憶寫。

- 模型固定用 `src/lib/claude/client.ts` 的 `MODEL`（`claude-opus-5`），不要為了省錢自行降級。
- thinking 預設 adaptive（可省略參數），用 `output_config.effort` 控制深度。**不要**用 `budget_tokens`、`temperature`，**不要**做 assistant prefill——這些在現行模型都會回 400。
- 對話一律 streaming（`client.messages.stream`）；非串流 `max_tokens` 約 16000，串流約 64000。
- 從對話抽藍圖用 `client.messages.parse` + `zodOutputFormat(BlueprintSchema)`；schema 只有一份，在 `src/lib/blueprint/schema.ts`，不要另外手刻 JSON schema。
- Prompt 順序固定：品牌規範 → 藍圖 → 該產物的指示 → 講師這次的要求。穩定的前段加 `cache_control`；時間戳、UUID 這類會變的內容一律放最後。
- 錯誤處理用 SDK 的 typed error class（`Anthropic.RateLimitError` 等），不要字串比對。

### MCP 與 plugin 規範

- 工具名稱一律 `rpai_platform_` 前綴、snake_case；改工具名或參數時，`plugin/skills/rpai-platform-runner/SKILL.md` 要同步改。
- 所有工具都以權杖對應的 `owner_id` 過濾資料；用 service role client 時**必須**自己加 owner 條件，不要相信 RLS 會擋。
- 檔案不走 MCP 傳：`request_upload` 給 signed URL，plugin 用 curl 上傳，再 `complete_job`。
- `plugin/skills/rpai-*` 是從帳號層 skill 複製來的；改內容以 repo 為準，再同步回帳號層。

### 資料規範

- `blueprints.content` 寫入前必須通過 `BlueprintSchema.parse()`。
- 新增欄位 = 新增一個 migration 檔（`supabase/migrations/NNNN_*.sql`），並同步更新 zod schema 與 `docs/architecture.md`。
- 所有表都開 RLS；資料只有 `owner_id` 本人可讀寫。

### 環境變數

名稱列在 `.env.example`；本機放 `.env.local`。永遠不要 commit、cat 或 echo 任何 `.env*`（`.env.example` 除外）。

## Git

在 `claude/*` 分支開發，不要直接推 default branch。
