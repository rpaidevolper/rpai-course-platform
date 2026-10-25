---
status: accepted
---

# 講師在自己的 AI 裡備課，平台是團隊的記憶與知識後台

講師平常就在自己的 Claude 裡用帳號層 rpai-* skill 談藍圖、做教材。原本的設計卻讓後台自己做一套藍圖對話，等於重做一次 `rpai-talk-blueprint`，又把平台綁死在 Claude API 上。所以講師的入口改到自己的 AI：v0 是 claude.ai 網站版或 Claude 桌面版，透過自訂連接器接上平台；Claude Code 本機也可以。平台只做一個 AI session 做不到的事，也就是記住團隊的東西：藍圖的每一版、每份產物出自哪一版、團隊最新的知識庫。對 AI 的門是 MCP，對人的門是網頁，後台本身不呼叫任何 AI。流程寫在 MCP server 的 instructions 與工具描述裡，資料用通用格式，所以之後換成 Codex 或其他支援 MCP 的 AI，平台不必改。三條規則的完整寫法在 CLAUDE.md「北極星」。

## Considered Options

- **後台自己做藍圖對話**（spec v0.1 F1、#78 的 #93）：要在平台裡重做 rpai-talk-blueprint，維護模型清單、串流、快取與 thinking 前綴的限制（#78 待決-28），還要付 API 費。講師也得離開平常用的 Claude。
- **平台的對話頁透過 API 帶 skill**：skill 要另外上傳到 API 並保持同步，後台還是綁在 Claude 上。
- **只用 Claude Code 當入口**：plugin 和權杖都已經做好，但講師平常用的是 claude.ai，而 Claude Code 網頁版是以 GitHub repo 為單位開 session 的寫程式工具。Claude Code 保留為可選的入口。

## Consequences

- 取代 `docs/architecture.md` 裡這幾項決定：後台的藍圖對話與抽藍圖（§2、§5）、雲端後備產檔，以及「網頁排產檔工作、Claude Code 認領」的佇列（§4）。「產檔用講師的訂閱、在講師那邊跑」的理由仍然成立，只是範圍從 Claude Code 擴大到講師的 AI。
- MCP 工具要讓講師的 AI 自己走完整個流程：開課、存藍圖、查知識庫、存回產物，不再靠網頁排工作。檔案仍然不走 MCP：用 signed URL 上傳；執行環境連不出去時，給講師一個一次性的上傳頁。
- 結案草稿這類需要 AI 的工作，也由講師的 AI 透過 MCP 完成，取代 #78 待決-11 原本「後台請 Claude 產草稿」的做法。
- v0 的身分：
  - claude.ai Team 方案的連接器由 Owner 加，header 帶一組全組織共用的權杖，平台會把所有人看成同一位講師。
  - 網頁用一組共用密碼（`DASHBOARD_PASSWORD`），看得到全部課程，等同 ADR 0004 的全團隊共用。
  - 要分出是哪位講師時，再做 OAuth。
- 還綁著 Claude 的，只剩 rpai-* skill 的內文，例如 claude.ai 的存檔路徑、依賴 Claude 內建的 pptx skill。skill 的格式是開放標準（Codex 也讀 `SKILL.md`），換 AI 時要改的是這幾處，不是平台。
- `src/lib/claude/` 與 Anthropic SDK 退場（#138）。
