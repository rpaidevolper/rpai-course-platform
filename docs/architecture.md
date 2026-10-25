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
| `rpai_platform_search_knowledge` | 查知識庫：模組框架、模組卡、單元卡、課程配方（全團隊共用） |
| `rpai_platform_read_knowledge` | 讀一份知識庫文件的完整內容 |
| `rpai_platform_request_artifact_upload` | 檢查產物規則、登記產物，回 signed upload URL 與一次性上傳頁連結 |
| `rpai_platform_complete_artifact_upload` | 確認 Storage 裡有檔案，把產物標成 ready |
| `rpai_platform_list_artifacts` | 列出課程的產物與過期原因 |
| `rpai_platform_get_artifact_download` | 10 分鐘的下載網址 |

網頁（`src/app/`）給人看平台記了什麼，不能改藍圖：

| 路徑 | 做什麼 |
|---|---|
| `/login` | 輸入團隊共用的密碼（`DASHBOARD_PASSWORD`），發一個 30 天的簽章 cookie；換密碼後舊 cookie 一律失效 |
| `/` | 全部課程，附最新藍圖版本 |
| `/courses/[id]` | 最新藍圖（五元素、待確認事項、檢查結果）、歷史版本、產物與過期原因 |
| `/artifacts/[id]/download` | 簽 10 分鐘、帶 download 選項的網址並導過去 |
| `/u/[artifactId]?t=` | 上傳頁：不用登入，靠一次性權杖；講師在瀏覽器選檔，直接傳到 Storage |
| `/demo` | 設計稿，瀏覽器裡的假資料 |

網頁看得到全部課程（等同 ADR 0004 的全團隊共用），MCP 仍以權杖的 owner 過濾。課程頁和 MCP 工具用同一組純函式（`checkBlueprint`、`openItems`、`blueprintReport`、`summarizeArtifacts`），兩邊看到的缺漏、待確認事項與過期原因一致。

## 3. 資料模型

> **名詞正在改版。** 產品模組已改成「專案 → 課程 → 場次」，並新增發布、學員入口與知識庫（名詞見 `GLOSSARY.md`，取捨見 [ADR 0002](adr/0002-each-course-owns-its-blueprint.md)）。下圖仍是目前 schema 的樣子：其中的 `Course` 指「一場課」，對應新名詞的「課程」加上「場次」。schema 會等設計稿（#22）對齊後另外設計。領域模型 v2（多天課程、課綱討論、定稿、客戶文件與需求條目）見 #25 與 [ADR 0003](adr/0003-page-script-as-upstream-artifact.md)；其中「逐頁腳本是產物」已由 [ADR 0005](adr/0005-page-script-merged-into-slides.md) 取代：講稿寫在簡報的 speaker notes，學員手冊的上游是該天的簡報。領域模型 v3（知識庫改成模組框架、模組卡、單元卡、課程配方與產業素材包；課程結案回存；全團隊共用一個工作區）見 #53、[ADR 0002 的修訂](adr/0002-each-course-owns-its-blueprint.md) 與 [ADR 0004](adr/0004-one-shared-workspace-for-all-instructors.md)。

```
Course（一場課）
 ├─ Conversation（對話串；purpose = blueprint | outline | slides | handbook）
 │   └─ Message（Anthropic content blocks 原樣存）
 ├─ Blueprint v1, v2, v3 …（結構化 JSON，唯一真相來源）
 └─ Artifact（產物；每一筆綁定「基於哪一版藍圖」，簡報與學員手冊另記第幾天）
      ├─ outline        v2  ready       ← blueprint v3
      ├─ slides   第1天 v1  ready       ← blueprint v2   ← 藍圖過期：藍圖已到 v3
      └─ handbook 第1天 v1  generating  ← blueprint v3   ← 等檔案上傳；上游是第 1 天的簡報 v1
ApiToken（講師的 Claude Code 權杖；只存 sha256）
```

關鍵設計：

- **對話不是真相來源，藍圖才是。** 對話結束（或講師按「更新藍圖」）時，用結構化輸出把對話抽成 `Blueprint` JSON 存成新版本。之後生成任何產物都只讀藍圖。
- **藍圖版本不可變。** 修改 = 新增一版，舊版保留，產物才能可靠地指向它出生時的那一版。
- **產物不自動重生。** 藍圖升版後 UI 標示過期產物；講師決定要不要重生。
- **產物分天、記上游。** `day` 是第幾天（課程大綱沒有）；`upstream_id` 是學員手冊的上游簡報；`edited_from_id` 是講師自己改過再上傳時，原本那一份。版本在「課程＋種類＋第幾天」裡遞增。
- **產物狀態。** `generating` 是已登記、等檔案上傳；`ready` 是平台確認過 Storage 裡有檔案。`pending`、`failed` 與 `runner`、`claimed_at`、`claimed_by` 是舊的工作佇列留下的，不再使用。
- **過期在讀取時算，不存。** `staleReasons()`（`src/lib/artifact-rules.ts`）：照舊版藍圖做的是 `blueprint_outdated`；學員手冊的上游簡報有新版、或上游本身照舊版藍圖做的是 `upstream_outdated`。
- **五元素是 schema 的一部分。** `elements.{theory, handsOn, takeaway, quote, story}` 哪一格是空的，`missingElements()` 直接算得出來。
- **時間骨架是天 → 時段 → 單元。** `days[].slots[].units[]`；時段預設 180 分鐘、不另排休息。總時長由 `totalMinutes()` 從時段推得，不另存。`checkBlueprint()` 逐時段比對單元分鐘加總，並標出純講述單元（`activity` 為 null）。每個單元記錄所屬模組 `module`（A1–B4）與應用層級 `level`（`L1`–`L5`、`na`＝不適用（純方法，評過了）或 `null`＝未評；單元卡與藍圖單元用同一組值，`checkBlueprint()` 把未評的單元列為 `unit_unrated`，準備度也列出），以及來源 `source`（`{ kind: unit_card | course, id, version, unit }`；`unit_card` 的 version 為 null，`course` 是該課程的藍圖版本；新做為 null）與沿用程度 `reuse`（`reuse` 沿用／`modify` 要改／`new` 新做），`checkBlueprint()` 把要改與新做的單元列為 `unit_needs_work`。課程「複製自哪門課程的哪一版藍圖」記在課程上（設計稿的 `Course.copiedFrom`），不在藍圖裡。`blueprints.content` 只是 jsonb，形狀改了不需要 migration，但改版前存的藍圖不符合新 schema。
- **工具與待確認事項。** `tools[]` 記名稱、方案等級（free／paid／enterprise）與是否已跟客戶確認；`openQuestions[]` 是物件（`text`、`audience`：client 問客戶／self 自己決定、`unit`：受影響單元的標題或 null，與 `carriesFrom` 同一種參照方式）。`checkBlueprint()` 回報 `open_question` 與 `unconfirmed_tool`；`openItems()` 把兩者合成一份清單（未確認工具視為問客戶），`clientEmailText()` 把問客戶的事項排成可貼進信件的文字（`src/lib/blueprint/open-items.ts`）。

- **知識庫是一張表。** `knowledge_documents` 存去識別化後的模組框架、模組卡、單元卡與課程配方：`kind`、`source_key`（來源 id 的 sha256，不含客戶名稱）、`modules`、`title`、`frontmatter`（jsonb）、`body`（Markdown）、`content_hash`、`flags`、`synced_at`、`retired_at`。全團隊共用、不屬於任何講師：開 RLS、不開 policy，只有伺服器端讀寫。由維護者在本機跑 `pnpm kb:sync` 同步（[`knowledge-sync.md`](knowledge-sync.md)）；帶旗標（文字含客戶名稱）或退役的文件，MCP 查不到。程式在 `src/lib/knowledge/`。

zod schema：`src/lib/blueprint/schema.ts`。DB schema：`supabase/migrations/`。

## 4. 產檔流程

講師在自己的 AI 裡說「做第 1 天的簡報」：

```
講師的 AI
  → rpai_platform_get_blueprint              讀最新一版藍圖（JSON、markdown、report）
  → 用 rpai-* skill 產出 .docx／.pptx／.html（claude.ai 在雲端的程式碼執行環境裡做，Claude Code 在講師的電腦上做）
  → rpai_platform_request_artifact_upload    檢查規則、登記產物（status=generating），拿 signed upload URL 與一次性上傳頁連結
  → HTTP PUT 上傳到 Supabase Storage         連不出去時，講師打開上傳頁在瀏覽器上傳
  → rpai_platform_complete_artifact_upload   確認 Storage 裡有檔案，標成 ready

要下載時：rpai_platform_get_artifact_download，或在網頁下載（10 分鐘的 signed URL，帶 download 選項 → attachment）
```

產物規則在 `src/lib/artifact-rules.ts`：課程大綱沒有 `day`，是 .docx；簡報一天一份，是 .pptx；學員手冊一天一份，是 .html，只限有動手環節的天，上游是那天最新的 ready 簡報。照舊版藍圖做，或那天還沒有簡報時照樣收下，但回 warning。簡報的逐頁講稿寫在 speaker notes，不是獨立產物（ADR 0005）。平台不會自動重做過期的產物。

上傳頁連結的權杖只存 sha256 與到期時間（`artifacts.meta`，2 小時），產物標成 ready 後就清掉（`src/lib/upload-token.ts`）。

MCP 工具在 `src/lib/mcp/tools/`，流程寫在 `src/lib/mcp/instructions.ts`，Claude Code 特有的事寫在 `plugin/skills/rpai-platform-runner/SKILL.md`。三邊的工具名要一致，`src/lib/mcp/instructions.test.ts` 會檢查。

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
| 長時間產檔在哪跑（已由「平台定位」一列取代：產檔在講師自己的 AI 裡跑，不限 Claude Code） | 講師自己的 Claude Code + plugin（MCP 橋接） | 用講師的訂閱與電腦；既有 skill 原樣可用；不踩「第三方產品不得使用訂閱登入」的政策。捨棄的選項：雲端 worker（要付 API 費、skill 要重新上傳）、Agent SDK 打包成 runner app（政策上需要 API key，還要做打包與金鑰分發） | 2026-09-03 |
| rpai-* skill 怎麼給講師 | 打包進 plugin | 講師裝一次就齊全，版本由 repo 控制 | 2026-09-03 |
| 檔案怎麼回到後台 | signed upload URL + PUT，不走 MCP；連不出去時講師用一次性的上傳頁 | pptx 幾 MB，塞進工具參數不可行；claude.ai 的程式碼執行環境不一定連得出去 | 2026-09-03、2026-10-25 |
| 講師身分 | 個人存取權杖（`rcp_` 開頭，只存 hash） | plugin 安裝時填一次；不用做 OAuth | 2026-09-03 |

## 7. 還沒決定的事

- **權杖管理 UI**：現在只有 `pnpm token:create`；後台要有「產生／撤銷權杖」頁。
- **分辨是哪位講師**：v0 的網頁用共用密碼，claude.ai 連接器用一組全組織共用的權杖，平台分不出是誰。要分人得做 OAuth（連接器）與個人登入（網頁）。
- **共用密碼的防護**：登入沒有次數限制；登出只刪瀏覽器的 cookie，被複製的 cookie 在 30 天內或換密碼前都有效。
- **結構化輸出的 schema 相容性**：`BlueprintSchema` 用了 `min(1)`、`min(2)` 這類限制，第一次真的呼叫 `extractBlueprint()` 時要確認 API 接受；不接受就把限制移到 `checkBlueprint()` 做。
- **藍圖 diff UI**：v2 → v3 改了什麼要讓講師看得到。
- **多講師／團隊**：已決定全團隊共用一個工作區（[ADR 0004](adr/0004-one-shared-workspace-for-all-instructors.md)）；目前 schema 只有單一 owner，schema v2 時改以工作區過濾。
- **沒完成的上傳**：要了上傳網址卻沒有完成的產物會一直停在 `generating`；之後可以定期清掉超過一天的。

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
                                smoke-test.sh ──► /api/health、/login、/、/demo、/u、/api/mcp
```

- 部署只由 GitHub Actions 觸發，Vercel 的 Git 自動部署關閉（`vercel.json`）。順序固定：migration 先、程式碼後，任何一步失敗就中止。
- 所以 migration 必須向下相容。
- 沒有 staging、沒有 PR preview。Production 資料庫的金鑰只在 Vercel 與 GitHub secrets，開發者不持有；PoC 階段的例外是 Claude Code on the web 的雲端環境設定，雲端 session 直接共用 production 資料庫（[ADR 0006](adr/0006-cloud-sessions-share-the-production-database.md)）。
- `Dockerfile` 與 `output: "standalone"` 保留給日後搬離 Vercel，目前部署用不到。
