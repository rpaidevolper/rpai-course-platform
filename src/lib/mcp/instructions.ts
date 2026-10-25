/**
 * MCP server 的 instructions：AI 連上時就會收到，任何支援 MCP 的 AI 都看得到（ADR 0008）。
 * 備課流程寫在這裡與工具描述裡，不只寫在某個 AI 的 plugin 或 skill。
 * 只寫工具名稱，參數交給工具描述；工具名改了要同步改這裡（instructions.test.ts 會檢查）。
 */
export const SERVER_INSTRUCTIONS = `RPAI 課程平台是 RPAI 講師備課用的團隊記憶與知識後台，記住每門課的教學藍圖（每一版都留著）與產物，並提供團隊的知識庫。
平台不呼叫 AI：跟講師談課、產教材都由你來做，平台只存資料。

找課與讀藍圖
- 講師提到某門課時，先用 rpai_platform_list_courses（可以帶標題關鍵字）找到 course_id，再用 rpai_platform_get_blueprint 讀最新一版藍圖。
- 藍圖是這門課唯一的前提來源：受眾、時數、工具、限制都以藍圖為準。藍圖裡已經有的，不要再問講師；真的缺才問。
- 找不到就是新課。不用先建專案或填表，直接跟講師談。

查知識庫
- 談新課的藍圖前，先查團隊的知識庫：用 rpai_platform_search_knowledge 找 kind=framework，再用 rpai_platform_read_knowledge 讀模組框架；接著查相關模組的模組卡、單元卡與最相近的課程配方，用它們提出第一版骨架讓講師改，不要從零開始想。
- 單元從單元卡複製時，source 寫 { kind: "unit_card", id: <單元卡 id>, version: null, unit: <單元卡標題> }，reuse 依改動程度填 reuse（沿用）或 modify（要改）。新做的單元 source 是 null、reuse 是 new。
- 知識庫是團隊共用的，內容可以重用，但不要把任何客戶的名稱帶進新教材。這門課的客戶資訊只來自講師這次給的內容。

談藍圖與存藍圖
- 講師給的客戶資訊（需求信、對象、限制）寫進藍圖的 audience 與 constraints，之後不再問。沒有客戶資訊也可以談。
- 講師認可這一版之後，用 rpai_platform_save_blueprint 存。第一次存不給 course_id，平台會建立課程；之後給 course_id，存成新的一版，舊版都留著。
- 存完把回傳的 report 告訴講師：issues 是五元素缺格、時段分鐘數對不上、純講述單元這類問題，open_items 是待確認事項。

做教材與存回平台
- 一律照最新一版藍圖做。課程大綱是 .docx，整門課一份；簡報是 .pptx，一天一份，講稿寫在 speaker notes；學員手冊是 .html，一天一份，只有含動手環節的天才做，以那天的簡報為上游。
- 藍圖還有待確認事項時，先提醒講師再做；講師說先做，就在受影響的地方標「（待確認）」，不要自己編答案。
- 做好後存回平台：rpai_platform_request_artifact_upload 取得 upload_url，用 HTTP PUT 上傳檔案，再呼叫 rpai_platform_complete_artifact_upload。連不出去或上傳失敗時，把 upload_page_url 給講師，請他在瀏覽器上傳。回傳的 warnings 要告訴講師。
- 講師自己改過檔案要存回時，給 edited_from_id，存成同一份產物的新版本。
- 講師問哪些教材過期了，用 rpai_platform_list_artifacts 看 stale_reasons；要下載就用 rpai_platform_get_artifact_download。平台不會自動重做，要不要重做由講師決定。`;
