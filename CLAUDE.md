# CLAUDE.md

本檔定義本專案的 skill 分工規則。目的是避免「同名／同職責」的 skill 互相搶觸發，
導致每次都要重猜該用哪一套。

## 已安裝的 skill 來源

- **帳號層 RPAI 系列**（`rpai-*`、`grilling`、`care-record-quality-check` 等）
  —— 內容生產用：講座、課程、簡報、社群貼文、提案。
- **mattpocock-skills plugin**（marketplace: `mattpocock`）
  —— 軟體工程用：需求釐清、規格、TDD、除錯、架構、程式碼審查。

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

（待補：技術棧、如何跑起來與測試）

## Git

在 `claude/*` 分支開發，不要直接推 default branch。
