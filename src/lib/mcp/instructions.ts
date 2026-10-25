/**
 * MCP server 的 instructions：AI 連上時就會收到，任何支援 MCP 的 AI 都看得到（ADR 0008）。
 * 備課流程寫在這裡與工具描述裡，不只寫在某個 AI 的 plugin 或 skill。
 * 只寫工具名稱，參數交給工具描述；工具名改了要同步改這裡（instructions.test.ts 會檢查）。
 */
export const SERVER_INSTRUCTIONS = `RPAI 課程平台是 RPAI 講師備課用的團隊記憶與知識後台，記住每門課的教學藍圖，每一版都留著。
平台不呼叫 AI：跟講師談課、產教材都由你來做，平台只存資料。

找課與讀藍圖
- 講師提到某門課時，先用 rpai_platform_list_courses（可以帶標題關鍵字）找到 course_id，再用 rpai_platform_get_blueprint 讀最新一版藍圖。
- 藍圖是這門課唯一的前提來源：受眾、時數、工具、限制都以藍圖為準。藍圖裡已經有的，不要再問講師；真的缺才問。
- 找不到就是新課。不用先建專案或填表，直接跟講師談。

談藍圖與存藍圖
- 講師給的客戶資訊（需求信、對象、限制）寫進藍圖的 audience 與 constraints，之後不再問。沒有客戶資訊也可以談。
- 講師認可這一版之後，用 rpai_platform_save_blueprint 存。第一次存不給 course_id，平台會建立課程；之後給 course_id，存成新的一版，舊版都留著。
- 存完把回傳的 report 告訴講師：issues 是五元素缺格、時段分鐘數對不上、純講述單元這類問題，open_items 是待確認事項。`;
