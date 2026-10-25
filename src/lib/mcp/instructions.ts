/**
 * MCP server 的 instructions：AI 連上時就會收到，任何支援 MCP 的 AI 都看得到（ADR 0008）。
 * 備課流程寫在這裡與工具描述裡，不只寫在某個 AI 的 plugin 或 skill；工具名或參數改了要同步改這裡。
 */
export const SERVER_INSTRUCTIONS = `RPAI 課程平台是 RPAI 講師備課用的團隊記憶與知識後台，記住每門課的教學藍圖（每一版都留著）與產物。
平台不呼叫 AI：跟講師談課、產教材都由你來做，平台只存資料。

- 講師提到某門課時，先用 rpai_platform_list_courses 找到它，再用 rpai_platform_get_blueprint 讀最新一版藍圖。
- 藍圖是這門課唯一的前提來源：受眾、時數、工具、限制都以藍圖為準。藍圖裡已經有的，不要再問講師。`;
