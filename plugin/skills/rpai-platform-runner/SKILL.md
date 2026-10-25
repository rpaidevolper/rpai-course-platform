---
name: rpai-platform-runner
description: >
  在 Claude Code 裡用 RPAI Course Platform 備課：找課、讀藍圖、查團隊知識庫、談完把藍圖存回平台，以及把做好的課程大綱、簡報、學員手冊存回平台。
  當使用者說「我要備一門 X 課」「繼續 X 課」「把藍圖存到平台」「做課程大綱」「做第 N 天的簡報／學員手冊」「存回平台」「哪些教材過期了」「/rpai-platform-runner」，
  或提到 course platform 時，立即使用此 skill。不要重問藍圖裡已經有的受眾／目標／時間。
---

# rpai-platform-runner

平台（RPAI Course Platform）是團隊的記憶與知識後台，記住每門課的藍圖與產物，並提供團隊的知識庫。**備課流程寫在平台 MCP server 的說明（instructions）與工具描述裡**，任何接上平台的 AI 都照它走；這個 skill 只補 Claude Code 特有的事：本機檔案放哪裡、怎麼用 curl 上傳。

## 前提

MCP server `rpai-course-platform` 必須已連線（安裝 plugin 時填的 `server_url` 與 `api_token`）。
工具呼叫失敗或找不到工具時，請使用者到 `/plugin` 檢查設定；**不要自己猜網址或權杖**，也不要把權杖印出來。

## 藍圖落地成本機檔案

照 MCP server 的說明找課、查知識庫、談藍圖、存藍圖。Claude Code 另外要把藍圖落地成本機檔案，讓 `rpai-*` skill 讀得到：

1. 用 `rpai_platform_get_blueprint` 讀到藍圖後，在目前工作目錄建立 `rpai-platform/<course_id>/`，寫兩個檔案：
   - `blueprint.v<版本>.json`：回傳的 `content`，原樣存。
   - `<課程標題>_教學藍圖.md`：回傳的 `markdown`，原樣存。下游 skill 開場會先找 `*_教學藍圖.md`，找到就不會重問前提。
2. 新課用 `rpai-talk-blueprint` 談。講師認可後，把藍圖整理成 `rpai_platform_save_blueprint` 要的 JSON 存回平台（欄位與說明見工具的 input schema），再照第 1 步落地新的版本。
3. 不要直接改本機的 `blueprint.v<版本>.json`。藍圖要改就存成新版，讓平台記住。

## 做教材

全部在 `rpai-platform/<course_id>/` 底下做，一律照最新一版藍圖。做之前先看 `rpai_platform_get_blueprint` 回傳的 `report.open_items`：有待確認事項就**先列給使用者**，依問客戶／自己決定分開列，問要不要先確認。使用者說先做，就在產物裡受影響的單元標「（待確認）」，不要自己編答案。

| 產物 | 做法 | 存回平台的檔案 |
|---|---|---|
| 課程大綱 | 用 `rpai-course-outline`，讀教學藍圖、不重問 | 客戶版課程大綱 `.docx`，不給 `day`。內部講師準備單也產，但留在本機，告知路徑即可 |
| 簡報 | 用 `rpai-pptx-workflow`（內部呼叫 `pptx` skill），一天一份。敘事模型直接用藍圖的 `narrative.model`，**不要再讓使用者挑**，除非使用者主動要換。逐頁講稿、互動提示與示範指令寫在 **speaker notes**，不另出逐頁腳本文件；逐頁結構在產簡報前的確認閘（簡報大綱）跟使用者確認 | `.pptx`，`day` 是第幾天 |
| 學員手冊 | 用 `rpai-course-content`，**HTML 單檔、一天一份**，只給含動手環節（藍圖裡 `activity` 不是 `null`）的天；純講述的天不產手冊，也不以講義取代。上游是那一天的簡報，前提仍只讀藍圖 | `.html`，`day` 是第幾天，檔名帶天數，例如 `<課程>_學員手冊_Day1.html` |

藍圖的天 → 時段 → 單元三層照順序排，總時長是各時段 `minutes` 的加總：**不要自己加休息**，也不要把第幾天搞混。`reuse` 是 `modify` 或 `new` 的單元要依藍圖重寫，不要照搬來源的舊內容。品牌規範一律讀 `rpai-brand-guidelines`。產出前後照各 skill 的自檢清單逐頁檢查。

## 存回平台

1. `rpai_platform_request_artifact_upload`：`course_id`、`kind`（`outline`／`slides`／`handbook`）、`day`（課程大綱不給）、`blueprint_version`（照哪一版藍圖做的）、`filename`。回傳 `artifact_id`、`upload_url`、`content_type`、`upload_page_url`、`warnings`。`warnings` 要告訴使用者。
2. 用 curl 上傳：
   ```bash
   curl -sS -f -X PUT -H "Content-Type: <content_type>" --data-binary @"<檔案路徑>" "<upload_url>"
   ```
3. `rpai_platform_complete_artifact_upload`（`artifact_id`）。

上傳失敗時，把 `upload_page_url` 給使用者，請他在瀏覽器上傳（2 小時內有效，只能用一次）。使用者自己改過檔案要存回時，第 1 步加上 `edited_from_id`（原本那份產物的 id，用 `rpai_platform_list_artifacts` 查），平台會記成同一份產物的新版本。

## 回報

告訴使用者：哪份產物存回了平台（第幾版、出自第幾版藍圖）、本機的路徑。使用者問哪些教材過期了，用 `rpai_platform_list_artifacts` 看 `stale_reasons`；要不要重做由使用者決定。

## 規則

- 不要重問藍圖已經回答的事。真的缺資訊才問，而且先看 `report.open_items`。
- 不要修改 `blueprint.v<版本>.json`；覺得藍圖該改，跟使用者確認後用 `rpai_platform_save_blueprint` 存成新版。
- 不要把知識庫裡其他客戶的名稱帶進新教材。
