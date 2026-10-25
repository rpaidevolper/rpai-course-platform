# RPAI Course Platform 架構

## 1. 這個產品在解什麼問題

> **北極星：讓 RPAI 講師把一門客製課，更快備到可以上課。** 做得好的標準：前提只談一次、教材彼此一致、每門課都從團隊最新的版本出發（[ADR 0007](adr/0007-north-star.md)）。

講師要準備一場課，通常得分別產出課程大綱、簡報、學員手冊，而這三樣東西本質上共用同一份 context：受眾是誰、目標是什麼、時間多長、要講哪些段落。分開做就會重複問三次、彼此不同步。

所以產品的核心不是「AI 幫你做簡報」，而是：

> 先跟 AI 把一份**教學藍圖**討論清楚，之後所有教材都從這份藍圖生成，藍圖改了下游就知道自己過期。

這條 pipeline 在 RPAI 既有的 skill 裡已經驗證過（`rpai-talk-blueprint` → `rpai-course-outline` / `rpai-course-content` / `rpai-pptx-workflow`），講師也已經在自己的 Claude 裡用它。所以本專案不重做那條鏈：講師在自己的 AI 裡談藍圖、產教材；平台是團隊的記憶與知識後台，記住藍圖的每一版、每份產物出自哪一版，並提供團隊的知識庫。對 AI 的門是 MCP，對人的門是網頁，後台不呼叫 AI（[ADR 0008](adr/0008-platform-is-memory-and-knowledge-backend.md)）。

## 2. 兩個部分

講師在自己的 AI 裡備課，平台是團隊的記憶與知識後台（[ADR 0008](adr/0008-platform-is-memory-and-knowledge-backend.md)）。

```
講師 ──► 講師的 AI（claude.ai／Claude 桌面版／Claude Code／Codex，帶 rpai-* skill）
             │ MCP：/api/mcp，Authorization: Bearer rcp_…
             ▼
         平台（Next.js + Supabase）：藍圖的每一版、產物登記、知識庫
             ▲
講師 ──► 網頁：看、下載、上傳
```

- **講師的 AI** 跟講師談藍圖、用 rpai-* skill 產教材。備課流程寫在 MCP server 的 instructions（`src/lib/mcp/instructions.ts`）與工具描述裡，任何支援 MCP 的 AI 都收得到；`plugin/skills/rpai-platform-runner/SKILL.md` 只補 Claude Code 特有的事。怎麼接上見 [`connect-ai.md`](connect-ai.md)。
- **平台**只存資料、簽檔案網址，不呼叫 AI。MCP 工具在 `src/lib/mcp/tools/`，一組工具一個 store（`src/lib/mcp/*-store.ts`）。store 用 service role client，每個查詢自己加 owner 條件。

| 工具 | 做什麼 |
|---|---|
| `rpai_platform_list_courses` | 用標題關鍵字找課程，附最新藍圖版本 |
| `rpai_platform_get_blueprint` | 讀某一版藍圖：JSON、給人讀的 Markdown、完整性檢查（report）、所有版本 |
| `rpai_platform_save_blueprint` | 存一版藍圖；沒給課程就建立課程，課程標題跟著最新一版 |

舊的工作佇列工具（`list_jobs`、`claim_job`、`request_upload`、`complete_job`、`fail_job`）由 #135 移除。

## 3. 資料模型

> **名詞正在改版。** 產品模組已改成「專案 → 課程 → 場次」，並新增發布、學員入口與知識庫（名詞見 `GLOSSARY.md`，取捨見 [ADR 0002](adr/0002-each-course-owns-its-blueprint.md)）。下圖仍是目前 schema 的樣子：其中的 `Course` 指「一場課」，對應新名詞的「課程」加上「場次」。schema 會等設計稿（#22）對齊後另外設計。領域模型 v2（多天課程、課綱討論、定稿、客戶文件與需求條目）見 #25 與 [ADR 0003](adr/0003-page-script-as-upstream-artifact.md)；其中「逐頁腳本是產物」已由 [ADR 0005](adr/0005-page-script-merged-into-slides.md) 取代：講稿寫在簡報的 speaker notes，學員手冊的上游是該天的簡報。領域模型 v3（知識庫改成模組框架、模組卡、單元卡、課程配方與產業素材包；課程結案回存；全團隊共用一個工作區）見 #53、[ADR 0002 的修訂](adr/0002-each-course-owns-its-blueprint.md) 與 [ADR 0004](adr/0004-one-shared-workspace-for-all-instructors.md)。

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
- **時間骨架是天 → 時段 → 單元。** `days[].slots[].units[]`；時段預設 180 分鐘、不另排休息。總時長由 `totalMinutes()` 從時段推得，不另存。`checkBlueprint()` 逐時段比對單元分鐘加總，並標出純講述單元（`activity` 為 null）。每個單元記錄所屬模組 `module`（A1–B4）與應用層級 `level`（`L1`–`L5`、`na`＝不適用（純方法，評過了）或 `null`＝未評；單元卡與藍圖單元用同一組值，`checkBlueprint()` 把未評的單元列為 `unit_unrated`，準備度也列出），以及來源 `source`（`{ kind: unit_card | course, id, version, unit }`；`unit_card` 的 version 為 null，`course` 是該課程的藍圖版本；新做為 null）與沿用程度 `reuse`（`reuse` 沿用／`modify` 要改／`new` 新做），`checkBlueprint()` 把要改與新做的單元列為 `unit_needs_work`。課程「複製自哪門課程的哪一版藍圖」記在課程上（設計稿的 `Course.copiedFrom`），不在藍圖裡。`blueprints.content` 只是 jsonb，形狀改了不需要 migration，但改版前存的藍圖不符合新 schema。
- **工具與待確認事項。** `tools[]` 記名稱、方案等級（free／paid／enterprise）與是否已跟客戶確認；`openQuestions[]` 是物件（`text`、`audience`：client 問客戶／self 自己決定、`unit`：受影響單元的標題或 null，與 `carriesFrom` 同一種參照方式）。`checkBlueprint()` 回報 `open_question` 與 `unconfirmed_tool`；`openItems()` 把兩者合成一份清單（未確認工具視為問客戶），`clientEmailText()` 把問客戶的事項排成可貼進信件的文字（`src/lib/blueprint/open-items.ts`）。

zod schema：`src/lib/blueprint/schema.ts`。DB schema：`supabase/migrations/`。

## 4. 產檔流程

> **已由 [ADR 0008](adr/0008-platform-is-memory-and-knowledge-backend.md) 取代。** 產物改由講師的 AI 直接存回平台，不再經過網頁排工作；本節由 #135 改寫。

```
講師在後台點「生成簡報」
  → artifacts 新增 (kind=slides, blueprint_id=v3, version=next, status=pending, runner=claude_code)

講師在自己的 Claude Code 說「有沒有待生成的教材」（rpai-platform-runner skill）
  → rpai_platform_list_jobs           列出 pending
  → rpai_platform_claim_job           pending→generating，回傳藍圖 JSON + 講師指示
  → 本機寫 <課程>_教學藍圖.md，跑對應的 rpai-* skill 產出 .pptx / .docx / .html
  → rpai_platform_request_upload      拿 Supabase Storage 的 signed upload URL
  → curl PUT 上傳
  → rpai_platform_complete_job        generating→ready，記 storage_path
  （失敗 → rpai_platform_fail_job）

講師回後台下載（後台簽 download URL，帶 `download` 選項 → attachment）
```

kind 對應：`outline` → `rpai-course-outline`（客戶版 .docx）；`slides` → `rpai-pptx-workflow`（.pptx）；`handbook` → `rpai-course-content`，產出 HTML 單檔學員實作手冊，一天一份，只給含動手環節的天（上游是該天的簡報；v1 只提供下載，不在平台網域內渲染）。簡報的逐頁講稿寫在 speaker notes，不是獨立產物（ADR 0005）。

> 範圍備註：真實 schema 的「按天產出」（`day` 欄位）與遺留路徑 `src/lib/claude/generate-artifact.ts`（仍產 .docx）留給後端母規格 #78。

MCP 工具定義在 `src/lib/mcp/`，plugin 端流程在 `plugin/skills/rpai-platform-runner/SKILL.md`，兩邊的工具名與參數要同步。

## 5. 後台的 AI 呼叫

> **已由 [ADR 0008](adr/0008-platform-is-memory-and-knowledge-backend.md) 取代：後台不呼叫 AI。** 本節描述的程式都沒有接線，由 #138 移除。

| 階段 | 用什麼 | 為什麼 |
|---|---|---|
| 藍圖對話 | Messages API streaming（`client.messages.stream`） | 即時回覆、自己掌控對話與存檔 |
| 抽藍圖 | `client.messages.parse` + `zodOutputFormat(BlueprintSchema)` | 直接拿到通過 schema 驗證的 JSON |
| 雲端後備產檔（未接線） | `client.beta.messages.stream` + `container.skills` + code execution（`src/lib/claude/generate-artifact.ts`） | 給沒有 Claude Code 的講師用；要啟用得先把 rpai-* skill 上傳成 API 自訂 skill，並補一個常駐 worker |

Prompt 組裝順序（影響快取命中）：品牌規範 + 角色設定（最穩定，加 `cache_control`）→ 藍圖 JSON（同版本內穩定）→ 該產物的指示 + 講師這次的要求（每次都變）。會變的內容永遠放最後。

## 6. 已做的決策

| 決策 | 選擇 | 理由 | 日期 |
|---|---|---|---|
| **平台定位** | **講師在自己的 AI 裡備課；平台是團隊的記憶與知識後台（MCP＋網頁），後台不呼叫 AI** | 一個 AI session 記不住團隊的事；講師留在平常用的 Claude；換成 Codex 等其他 AI 也能用（[ADR 0008](adr/0008-platform-is-memory-and-knowledge-backend.md)）。下面的「模型」一列因此退場 | 2026-10-25 |
| 技術棧 | Next.js 16 + TypeScript，單一 repo | 前後端一起、串流聊天順手 | 2026-09-03 |
| 資料庫 | Supabase Postgres + Storage，RLS 依 owner_id | 登入、檔案、資料庫一站解決 | 2026-09-03 |
| 模型 | 預設 `claude-opus-5-5`，每場對話可在 `conversations.model` 各自選（Opus 5.5／Sonnet 5.5／最新版 Haiku（目前 5.5）／Fable 5.1，清單在 `src/lib/claude/models.ts`）；不指定 thinking（各模型用自己的預設），用 effort 調深度 | 依 claude-api skill 的預設；講師依草稿／定稿、成本、速度自選 | 2026-09-03、2026-10-02、2026-10-24 |
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
- **多講師／團隊**：已決定全團隊共用一個工作區（[ADR 0004](adr/0004-one-shared-workspace-for-all-instructors.md)）；目前 schema 只有單一 owner，schema v2 時改以工作區過濾。
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
- 沒有 staging、沒有 PR preview。Production 資料庫的金鑰只在 Vercel 與 GitHub secrets，開發者不持有；PoC 階段的例外是 Claude Code on the web 的雲端環境設定，雲端 session 直接共用 production 資料庫（[ADR 0006](adr/0006-cloud-sessions-share-the-production-database.md)）。
- `Dockerfile` 與 `output: "standalone"` 保留給日後搬離 Vercel，目前部署用不到。
