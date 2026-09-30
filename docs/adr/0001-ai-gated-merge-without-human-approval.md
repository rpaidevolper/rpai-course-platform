---
status: accepted
---

# 合併到 main 不要求人類 approve，由 CI 與 AI review 把關

團隊只有 2–4 人且產品尚未上線，等人 review 會拖慢迭代，所以 `main` 的 ruleset 把必要的人類 approve 數設為 0。取而代之的關卡是：四個 CI check、`pr-conventions`（PR 必須連結 issue）、每個 PR 自動執行的 AI review，以及「所有 review 對話必須 resolved 才能合併」。AI review 的 inline 留言因此無法被略過，作者必須逐條修正或回覆理由。

## Considered Options

- **要求 1 位人類 approve**：AI 產出的程式碼有獨立的人類檢查，但只有兩人時對方不在就會卡住。上線或團隊擴大後應改回這個選項，做法是把 `.github/rulesets/main.json` 的 `required_approving_review_count` 改成 1。
- **Git-flow（develop / release 分支）**：沒有排程發版的需求，多一層分支只增加負擔。

## Consequences

- AI 寫、AI 審，沒有人類擋錯。規格的品質（issue 的驗收條件）直接決定 review 的品質，所以「沒有 issue 就沒有 PR」是強制的。
- `ai-review` 是 required check，Claude 服務中斷或額度用完時無法合併。屆時由 owner 執行 `scripts/setup-github.sh --without-ai-review` 暫時解除，恢復後重新執行不帶參數的版本。
