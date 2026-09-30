# Repo 協作基礎設施設計

日期：2026-09-30
狀態：已實作

## 目標

把 repo 建成 2–4 位工程師（全員使用 Claude Code）可以一起開發的狀態，採用 AI native 的 SDD / TDD 流程。產品功能（講師後台、AI 對話、藍圖 → 課程架構／簡報／學員手冊）不在本次範圍，會是下一個子專案，並用這次建好的流程來做。

## 前提

- 遠端：`rpaidevolper/rpai-course-platform`，public。`rpaidevolper` 是個人帳號，只當 owner；成員用各自的帳號當 collaborator。
- 技術棧：Next.js + TypeScript + Supabase。repo 在 2026-09-03 已有產品骨架（原 `claude/lecturer-studio-setup` 分支），先合併進 `main` 作為基礎，本次不另建骨架。
- Workflow skills：採用 Claude Code 官方 marketplace 的 `mattpocock-skills` plugin，不 vendoring、不自寫。
- 語言：issue、spec、文件用繁體中文；程式碼、commit message、分支名用英文。

## 1. Ticket 生命週期

```
想法 / 需求
  → /grill-with-docs   釐清需求，更新 GLOSSARY.md 與 docs/adr/
  → /to-spec           spec 發佈成 GitHub issue（ready-for-agent）
  → /to-tickets        拆成垂直切片的 issue，標明 blocked-by
  → /implement + /tdd  每張 ticket 一個分支，紅 → 綠 → 重構
  → /code-review → /pr 本機自審後開 PR，連結 issue
  → CI + AI review 通過、對話全部 resolved → squash merge → issue 自動關閉
```

- Spec 與 ticket 住在 GitHub Issues。repo 內只保留長期知識：`GLOSSARY.md` 與 `docs/adr/`。
- 外部進來的 issue 走 `/triage`。
- 沒有 issue 就沒有 PR。

## 2. GitHub policy

### `main` ruleset

| 規則 | 設定 |
|---|---|
| 必須經 PR | 開 |
| 需要的人類 approve 數 | 0（日後要加人類把關，改成 1） |
| Required status checks | `lint`、`typecheck`、`test`、`build`、`pr-conventions`、`ai-review` |
| Review 對話必須 resolved | 開 |
| 合併方式 | 只允許 squash；合併後自動刪分支 |
| Force push、刪除 `main` | 禁止 |
| Bypass 名單 | 無 |

### 約定

- PR 標題使用 Conventional Commits，由 `pr-conventions` 強制。
- PR 內文必須含 `Closes #N`（或 `Fixes` / `Resolves`），由 `pr-conventions` 強制。
- 分支名 `<issue 編號>-<英文簡述>`，只約定不強制。

### Labels

狀態：`needs-triage`、`needs-info`、`ready-for-agent`、`ready-for-human`、`wontfix`。
分類：`bug`、`enhancement`。
GitHub 預設的其他 label 刪除。

### Templates

- Issue：Bug 回報、想法／需求兩種繁中表單，自動貼 `needs-triage`。保留空白 issue。
- PR：連結的 issue、變更摘要、測試證據。
- 不設 CODEOWNERS。

### Policy as code

`.github/rulesets/main.json` 與 `.github/labels.json` 為唯一來源，`scripts/setup-github.sh` 以 `gh api` 套用，可重複執行。

## 3. CI 與 GitHub 端 AI

| Workflow | 觸發 | 內容 | Required |
|---|---|---|---|
| `ci.yml` | PR、push 到 `main` | `lint`、`typecheck`、`test`、`build` | 是 |
| `pr-conventions.yml` | PR 開啟／編輯／更新 | 標題格式、issue 連結 | 是 |
| `ai-review.yml` | collaborator 的非 draft PR | Claude 依 issue 驗收條件、`GLOSSARY.md`、ADR、測試品質 review，留 inline 留言 | 是 |
| `claude.yml` | 留言含 `@claude` | 回答或依指示修改，限有寫入權限者 | 否 |

- `ai-review` 為 required 代表「review 必須跑完」；review 意見由「對話必須 resolved」擋下。
- Fork 來的 PR 不觸發 AI workflow，`ai-review` job 以 skip 通過，不消耗額度。
- Claude 憑證使用訂閱的 OAuth token，存成 repo secret `CLAUDE_CODE_OAUTH_TOKEN`。Claude 服務中斷時，由 owner 執行 `scripts/setup-github.sh --without-ai-review` 暫時自 ruleset 移除 `ai-review`。

## 4. Repo 結構

本次新增或修改的檔案：

```
README.md                 產品簡介 + 新成員上手指南 + owner 維運
CLAUDE.md                 新增 Agent skills 區塊與 Git／PR 規則
docs/adr/                 0001 記錄「不要求人類 approve」的決定
docs/agents/              issue-tracker.md、triage-labels.md、domain.md
docs/specs/               本文件
.github/workflows/        ci.yml、pr-conventions.yml、ai-review.yml、claude.yml
.github/ISSUE_TEMPLATE/   bug.yml、idea.yml、config.yml
.github/pull_request_template.md
.github/rulesets/main.json
.github/labels.json
scripts/setup-github.sh
```

`docs/agents/*` 取自 `/setup-matt-pocock-skills` 的種子範本：tracker 為 GitHub、預設 triage labels、single-context 網域文件。`GLOSSARY.md` 不預先建立，由 `/grill-with-docs` 在第一次釐清名詞時產生。`.claude/settings.json` 既有設定已啟用 `mattpocock-skills`，不需修改。

## 5. 既有骨架

沿用既有的 Next.js 16 + TypeScript strict + ESLint + Vitest + pnpm 骨架。`pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm build` 對應四個 CI job。

## 6. 驗收

1. 直接 push 到 `main` 被拒絕。
2. 開一個測試 PR：六個 required check 都出現並通過；標題不合格式或缺 issue 連結時 `pr-conventions` 失敗。
3. AI review 在 PR 上留言；有未 resolved 的對話時無法合併。
4. 在 issue 留言 `@claude` 得到回應。
5. 全新 clone 後開 Claude Code，可使用 `/grill-with-docs`、`/to-spec`、`/to-tickets`、`/triage`。
6. `scripts/setup-github.sh` 重複執行結果不變。

## 需要 owner 手動提供

- 以 `rpaidevolper` 登入 `gh`（ruleset、secret、collaborator 都需要 owner 權限）。
- 設定 repo secret `CLAUDE_CODE_OAUTH_TOKEN` 並安裝 Claude GitHub App。
- Collaborator 的 GitHub 帳號清單。

## 不在範圍

- 產品功能。
- Issue 貼 label 自動由 AI 實作。
- 部署、預覽環境、GitHub Projects 看板。
