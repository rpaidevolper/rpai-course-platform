---
name: rpai-platform-runner
description: >
  處理 RPAI Course Platform 後台排下來的教材生成工作。當使用者說「跑平台的工作」「處理待生成的教材」
  「有沒有待生成的教材」「幫我把後台排的簡報／大綱／手冊做出來」「/rpai-platform-runner」，或提到
  course platform、教材佇列、jobs 時，立即使用此 skill。流程是：用 MCP 拉藍圖 → 在本機用 rpai-* skill
  產檔 → 把成品上傳回平台。不要自己重問受眾／目標／時間，這些都在藍圖裡。
---

# rpai-platform-runner

後台（RPAI Course Platform）負責跟講師談出教學藍圖並排工作；**產檔在講師自己的 Claude Code 裡跑**，
用的是這個 plugin 打包的 `rpai-*` skill。這個 skill 負責把兩邊接起來。

## 前提

MCP server `rpai-course-platform` 必須已連線（安裝 plugin 時填的 `server_url` 與 `api_token`）。
工具呼叫失敗或找不到工具時，請使用者到 `/plugin` 檢查設定；**不要自己猜網址或權杖**，也不要把權杖印出來。

## 流程

### 1. 列出待處理工作

呼叫 `rpai_platform_list_jobs`。

- 沒有工作 → 告訴使用者，結束。
- 一個以上 → 列出（課程、產物類型、藍圖版本、排入時間）讓使用者選；使用者說「全部」就依序做，**一次只做一個**。

### 2. 認領工作並落地藍圖

呼叫 `rpai_platform_claim_job`，`claimed_by` 填機器名稱或使用者名稱。回傳內容包含 `kind`、課程資訊、
`blueprint`（JSON）、`blueprint_version`、講師的 `instructions`。

在目前工作目錄建立 `rpai-platform/<course_id>/`，寫兩個檔案：

1. `blueprint.v<版本>.json` —— 原始 JSON，原樣存。
2. `<課程標題>_教學藍圖.md` —— 依 `rpai-talk-blueprint` skill 的固定結構整理成 Markdown。
   下游 skill 開場都會先找 `*_教學藍圖.md`，找到就不會重問前提。

藍圖 JSON 欄位對應：`audience` → 受眾、`outcomes` → 教學目標、`elements` → 五元素落點、
`narrative` → 敘事主軸、`modules` → 時間骨架、`constraints` → 限制、`openQuestions` → 待確認。

`openQuestions` 不是空的 → **先列給使用者**，問要不要先確認。使用者說先做，就在產物裡標「（待確認）」，不要自己編答案。

### 3. 依 kind 產檔

全部在 `rpai-platform/<course_id>/` 底下做。講師在 `instructions` 裡的要求優先於 skill 的預設值。

| kind | 做法 | 上傳的檔案 |
|---|---|---|
| `outline` | 用 `rpai-course-outline`，讀教學藍圖、不重問 | 客戶版課程大綱 `.docx`（內部講師準備單也產，但留在本機，告知路徑即可） |
| `slides` | 用 `rpai-pptx-workflow`（內部呼叫 `pptx` skill）。敘事模型直接用藍圖的 `narrative.model`，**不要再讓使用者挑**，除非使用者主動要換 | `.pptx` |
| `handbook` | 先用 `rpai-course-content` 展開各單元內容，再用 `docx` skill 依 `rpai-brand-guidelines` 排成學員手冊：課前準備、每單元重點整理與練習欄位、帶走工具清單、延伸資源 | 學員手冊 `.docx` |

品牌規範一律讀 `rpai-brand-guidelines`。產出前後照各 skill 的自檢清單逐頁檢查。

### 4. 上傳成品

1. `rpai_platform_request_upload`（`job_id`、`filename`）→ 回傳 `upload_url`、`storage_path`、`content_type`。
2. 用 curl 上傳（`upload_url` 是一次性的 signed URL，幾分鐘內有效）：
   ```bash
   curl -sS -f -X PUT -H "Content-Type: <content_type>" --data-binary @"<檔案路徑>" "<upload_url>"
   ```
3. `rpai_platform_complete_job`（`job_id`、`storage_path`）。

任何一步失敗、或使用者中途取消 → 呼叫 `rpai_platform_fail_job` 寫明原因，**不要讓工作卡在 generating**。

### 5. 回報

告訴使用者：哪個工作完成、成品在本機的路徑、平台上已可下載。還有其他待處理工作就問要不要繼續。

## 規則

- 不要跳過認領直接產檔；沒認領的工作平台不會知道有人在做。
- 不要重問藍圖已經回答的事。真的缺資訊才問，而且先看 `openQuestions`。
- 不要修改 `blueprint.v<版本>.json`；覺得藍圖該改，回報給使用者去後台改，讓它升版。
