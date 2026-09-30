# RPAI Course Platform

講師教材準備後台。講師先跟 AI 談出一份**教學藍圖**，再從同一份藍圖產出課程大綱、簡報與學員手冊。

| 部分 | 在哪跑 | 做什麼 |
|---|---|---|
| 後台（本 repo 的 Next.js app） | 伺服器 | 藍圖對話、版本管理、排產檔工作、產物下載、MCP server |
| Claude Code plugin（`plugin/`） | 講師自己的電腦 | 用 MCP 拉藍圖、用 rpai-* skill 產檔、上傳成品 |

產品規格見 [`docs/spec.md`](docs/spec.md)，架構見 [`docs/architecture.md`](docs/architecture.md)。

---

# 新成員上手指南

這個 repo 採 AI native 的開發方式：需求先用 AI 拷問釐清、寫成規格、拆成工單，再由 AI 以 TDD 實作，PR 由 CI 與 AI review 把關。你主要的工作是把需求講清楚、判斷 AI 的產出對不對。

## 1. 取得權限與工具

1. 請 owner（`rpaidevolper`）把你的 GitHub 帳號加為 collaborator，到信箱接受邀請。
2. 安裝：
   - [Node.js](https://nodejs.org/) 24 以上
   - [pnpm](https://pnpm.io/installation)（`corepack enable` 即可）
   - [GitHub CLI](https://cli.github.com/)，裝好後執行 `gh auth login`
   - [Claude Code](https://claude.com/claude-code)

## 2. 把專案跑起來

```bash
git clone https://github.com/rpaidevolper/rpai-course-platform.git
cd rpai-course-platform
pnpm install
cp .env.example .env.local     # 向團隊索取 Anthropic 與 Supabase 金鑰後填入
pnpm lint && pnpm typecheck && pnpm test
pnpm dev                       # http://localhost:3000
```

資料庫：把 `supabase/migrations/` 依序套到 Supabase 專案。

`lint`、`typecheck`、`test` 不需要金鑰就能跑，三個都過代表環境沒問題。

## 3. 啟用 AI workflow

在 repo 目錄執行 `claude`。第一次開啟會詢問是否信任這個專案並安裝 `mattpocock-skills` plugin，選同意。之後輸入 `/` 應該能看到 `/grill-with-docs`、`/to-spec`、`/to-tickets`、`/implement`、`/triage` 等指令。

沒有出現的話手動安裝：

```bash
claude plugin marketplace add mattpocock/skills
claude plugin install mattpocock-skills@mattpocock
```

專案規範寫在 [`CLAUDE.md`](CLAUDE.md)，Claude Code 會自動讀取。你自己也讀一遍，那是你和 AI 共用的規則。

## 4. 開發流程

一個功能從想法到合併：

| 步驟 | 指令 | 產出 |
|---|---|---|
| 1. 釐清需求 | `/grill-with-docs` | 你和 AI 對需求有共識；新名詞寫進 `GLOSSARY.md`，難以反悔的決定寫進 `docs/adr/` |
| 2. 寫規格 | `/to-spec` | 一張 spec issue |
| 3. 拆工單 | `/to-tickets` | 數張 ticket issue，每張是一個可獨立驗證的垂直切片，並標明被哪些 ticket 擋住 |
| 4. 實作 | `/implement` | 一張 ticket 一個分支，先寫失敗的測試再寫實作 |
| 5. 自審 | `/code-review` | 對照 ticket 與專案規範檢查 |
| 6. 開 PR | `/pr` | 連結 ticket 的 PR |
| 7. 合併 | GitHub | 所有 check 通過、AI review 的留言都處理完，按 Squash and merge |

小改動不必從第 1 步開始，但一定要有 issue。修 bug 時請 Claude 用 `diagnosing-bugs` 先找到原因再修。

## 5. 你的第一個 PR

1. 到 [Issues](https://github.com/rpaidevolper/rpai-course-platform/issues) 挑一張 `ready-for-agent` 的 ticket，把自己設為 assignee。
2. 在 Claude Code 輸入 `/implement #<issue 編號>`。
3. 實作完成後 `/code-review`，再 `/pr`。
4. 到 GitHub 看 PR：等 check 跑完，處理 AI review 的留言，全部 resolved 後合併。

沒有 `ready-for-agent` 的 ticket 時，挑一張 `needs-triage` 的 issue，用 `/triage` 把它釐清成可以實作的狀態。

## 6. 規則

由 GitHub 強制，不符合就無法合併：

- 不能直接 push 到 `main`，一律走 PR。
- PR 標題用 Conventional Commits，例如 `feat: add blueprint chat`。類型：`feat` `fix` `docs` `refactor` `test` `chore` `ci` `build` `perf` `style` `revert`。
- PR 內文要有 `Closes #<issue 編號>`。
- `lint`、`typecheck`、`test`、`build`、`pr-conventions`、`ai-review` 六個 check 都要通過。
- PR 上所有 review 對話都要 resolved。AI review 的每一則 inline 留言，修掉或回覆不修的理由後再 resolve。

團隊約定：

- 分支名 `<issue 編號>-<英文簡述>`，例如 `12-blueprint-chat`。
- Issue、spec、文件用繁體中文；程式碼、commit message、分支名用英文。
- 還沒準備好就開 draft PR，draft 不會觸發 AI review。

目前不要求人類 approve，原因與之後如何改回來見 [ADR 0001](docs/adr/0001-ai-gated-merge-without-human-approval.md)。

## 7. Issue 與 label

每張 issue 有一個分類（`bug` 或 `enhancement`）和一個狀態：

| 狀態 | 意思 |
|---|---|
| `needs-triage` | 剛進來，還沒評估 |
| `needs-info` | 等回報者補充 |
| `ready-for-agent` | 規格完整，可以直接交給 agent 做 |
| `ready-for-human` | 需要人來做（要判斷、要外部權限、要手動測試） |
| `wontfix` | 不處理 |

從 template 開的 issue 自動是 `needs-triage`。`/to-spec` 和 `/to-tickets` 產生的 issue 直接是 `ready-for-agent`。

## 8. 在 GitHub 上使用 Claude

在 issue 或 PR 留言提到 `@claude`，它會回答問題或依指示修改程式碼。只有 collaborator 的留言會觸發。

## 9. 常用指令

| 目的 | 指令 |
|---|---|
| 開發 | `pnpm dev` |
| Lint | `pnpm lint` |
| 型別檢查 | `pnpm typecheck` |
| 測試 | `pnpm test`（單檔：`pnpm test src/lib/blueprint/schema.test.ts`） |
| Build | `pnpm build` |
| 建講師權杖 | `pnpm token:create --user <auth.users.id> --label 名稱` |
| 測講師端 plugin | `claude --plugin-dir ./plugin`（安裝說明見 [`plugin/README.md`](plugin/README.md)） |

## 10. 文件地圖

| 檔案 | 內容 |
|---|---|
| [`CLAUDE.md`](CLAUDE.md) | 給 Claude Code 與人共用的專案規範、skill 分工 |
| [`docs/spec.md`](docs/spec.md) | 產品規格 |
| [`docs/architecture.md`](docs/architecture.md) | 資料模型、產檔流程 |
| `docs/adr/` | 架構與流程決策記錄 |
| `docs/agents/` | workflow skills 讀的設定（issue tracker、labels、文件位置） |
| `GLOSSARY.md` | 專案共同語言，由 `/grill-with-docs` 在第一次釐清名詞時建立 |

---

# Owner 維運

以下需要 `rpaidevolper` 帳號。

- **GitHub 規則**：ruleset 在 `.github/rulesets/main.json`，labels 在 `.github/labels.json`。修改後走 PR 合併，再執行 `scripts/setup-github.sh` 套用。
- **Claude 憑證**：GitHub 端的 AI review 與 `@claude` 使用 repo secret `CLAUDE_CODE_OAUTH_TOKEN`。更新方式：執行 `claude setup-token` 取得 token，再執行 `gh secret set CLAUDE_CODE_OAUTH_TOKEN`。
- **Claude 服務中斷或額度用完**：`ai-review` 是必要 check，會擋住所有合併。執行 `scripts/setup-github.sh --without-ai-review` 暫時解除，恢復後再執行不帶參數的版本。
- **新增成員**：Settings → Collaborators 加入對方的 GitHub 帳號。
