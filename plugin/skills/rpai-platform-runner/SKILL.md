---
name: rpai-platform-runner
description: >
  在 Claude Code 裡用 RPAI Course Platform 備課：找課、讀藍圖、談完把藍圖存回平台，以及處理後台排下來的教材生成工作。
  當使用者說「我要備一門 X 課」「繼續 X 課」「把藍圖存到平台」「跑平台的工作」「有沒有待生成的教材」「/rpai-platform-runner」，
  或提到 course platform、教材佇列、jobs 時，立即使用此 skill。不要重問藍圖裡已經有的受眾／目標／時間。
---

# rpai-platform-runner

平台（RPAI Course Platform）是團隊的記憶與知識後台，記住每門課的藍圖。**備課流程寫在平台 MCP server 的說明（instructions）與工具描述裡**，任何接上平台的 AI 都照它走；這個 skill 只補 Claude Code 特有的事：本機檔案放哪裡、怎麼用 curl 上傳。

## 前提

MCP server `rpai-course-platform` 必須已連線（安裝 plugin 時填的 `server_url` 與 `api_token`）。
工具呼叫失敗或找不到工具時，請使用者到 `/plugin` 檢查設定；**不要自己猜網址或權杖**，也不要把權杖印出來。

## 備課：找課、讀藍圖、存藍圖

照 MCP server 的說明走。Claude Code 另外要把藍圖落地成本機檔案，讓 `rpai-*` skill 讀得到：

1. 用 `rpai_platform_get_blueprint` 讀到藍圖後，在目前工作目錄建立 `rpai-platform/<course_id>/`，寫兩個檔案：
   - `blueprint.v<版本>.json`：回傳的 `content`，原樣存。
   - `<課程標題>_教學藍圖.md`：回傳的 `markdown`，原樣存。下游 skill 開場會先找 `*_教學藍圖.md`，找到就不會重問前提。
2. 新課用 `rpai-talk-blueprint` 談。講師認可後，把藍圖整理成 `rpai_platform_save_blueprint` 要的 JSON 存回平台（欄位與說明見工具的 input schema），再照第 1 步落地新的版本。
3. 不要直接改本機的 `blueprint.v<版本>.json`。藍圖要改就存成新版，讓平台記住。

## 處理後台排下來的產檔工作

### 1. 列出待處理工作

呼叫 `rpai_platform_list_jobs`。

- 沒有工作 → 告訴使用者，結束。
- 一個以上 → 列出（課程、產物類型、藍圖版本、排入時間）讓使用者選；使用者說「全部」就依序做，**一次只做一個**。

### 2. 認領工作並落地藍圖

呼叫 `rpai_platform_claim_job`，`claimed_by` 填機器名稱或使用者名稱。回傳內容包含 `kind`、課程資訊、
`blueprint`（JSON）、`blueprint_version`、講師的 `instructions`。

再用 `rpai_platform_get_blueprint`（`course_id` 與工作的 `blueprint_version`）取得同一版藍圖的 `markdown`，照「備課」第 1 步落地成本機檔案。

藍圖的天 → 時段 → 單元三層照順序排，總時長是各時段 `minutes` 的加總：**不要自己加休息**，也不要把第幾天搞混。
`reuse` 是 `modify` 或 `new` 的單元，產檔時要依藍圖重寫，不要照搬來源的舊內容。

有待確認事項（`get_blueprint` 回傳的 `report.open_items` 不是空的）→ **先列給使用者**，依問客戶／自己決定分開列，問要不要先確認。使用者說先做，就在產物裡受影響的單元標「（待確認）」，不要自己編答案。

### 3. 依 kind 產檔

全部在 `rpai-platform/<course_id>/` 底下做。講師在 `instructions` 裡的要求優先於 skill 的預設值。

| kind | 做法 | 上傳的檔案 |
|---|---|---|
| `outline` | 用 `rpai-course-outline`，讀教學藍圖、不重問 | 客戶版課程大綱 `.docx`（內部講師準備單也產，但留在本機，告知路徑即可） |
| `slides` | 用 `rpai-pptx-workflow`（內部呼叫 `pptx` skill）。敘事模型直接用藍圖的 `narrative.model`，**不要再讓使用者挑**，除非使用者主動要換。逐頁講稿、互動提示與示範指令寫在 **speaker notes**，不另出逐頁腳本文件；逐頁結構在產簡報前的確認閘（簡報大綱）跟使用者確認 | `.pptx` |
| `handbook` | 用 `rpai-course-content` 產出學員實作手冊，**HTML 單檔、一天一份**，只給含動手環節（藍圖裡 `activity` 不是 `null`）的天；純講述的天不產手冊，也不以講義取代。**一個工作只產一天**：#95 在工作上加 `day` 之前，工作本身沒有天數，只產 `instructions` 裡指定的那一天；說明沒指定是哪一天，就呼叫 `rpai_platform_fail_job` 回報失敗並寫明「工作沒指定是哪一天」，不要自己猜，也不要一次產全部的天。上游是那一天的簡報（`.pptx`），前提仍只讀藍圖。`rpai-course-content` 不產逐頁腳本 | 學員手冊 `.html`（每個動手天一份，檔名帶天數，例如 `<課程>_學員手冊_Day1.html`） |

手冊是 HTML 檔，平台 v1 只提供下載，不在平台網域內渲染。品牌規範一律讀 `rpai-brand-guidelines`。產出前後照各 skill 的自檢清單逐頁檢查。

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
- 不要重問藍圖已經回答的事。真的缺資訊才問，而且先看 `openQuestions` 與未確認的 `tools`。
- 不要修改 `blueprint.v<版本>.json`；覺得藍圖該改，跟使用者確認後用 `rpai_platform_save_blueprint` 存成新版。
