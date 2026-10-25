# 把 AI 接上平台

講師在自己的 AI 裡備課，平台透過 MCP 記住每門課的藍圖與產物，並提供團隊的知識庫（ADR 0008）。這份文件說明怎麼把各家 AI 接上平台的 MCP server。

所有 AI 都連同一個網址，帶同一種權杖：

| 項目 | 值 |
|---|---|
| MCP 網址 | `https://<平台網址>/api/mcp`，正式環境是 `https://rpai-course-platform.vercel.app/api/mcp` |
| 驗證 | HTTP header `Authorization: Bearer rcp_…` |
| 權杖 | owner 用 `pnpm token:create --user <auth.users.id> --label <名稱>` 建立，只顯示一次 |

平台把每組權杖對到一位講師，MCP 工具只看得到那位講師的課程。知識庫是全團隊共用的，任何權杖都查得到。

權杖等於這位講師在平台上的身分：不要貼進對話、issue 或 commit。外洩時請 owner 在 Supabase 把那筆 `api_tokens` 的 `revoked_at` 設成現在時間，再建一組新的。

## claude.ai 網站版與 Claude 桌面版

Team 方案只有 Owner 能加自訂連接器，而且整個組織共用一組權杖，所以平台會把所有人看成同一位講師。v0 接受這一點；要分人得做 OAuth（#131 的範圍外）。

### Owner：加連接器（一次）

1. 建一個代表團隊的使用者（Supabase → Authentication → Add user），用它的 id 建權杖：`pnpm token:create --user <id> --label "claude.ai 連接器"`。
2. 到 claude.ai 的 **Organization settings → Connectors**，按 **Add**，選 **Custom → Web**。
3. 名稱填「RPAI 課程平台」，網址填上面的 MCP 網址，按 **Continue**。
4. **Authentication** 選 **No sign in**。
5. 在 **Request headers** 加一個 header：名稱 `authorization`，值 `Bearer <權杖>`，設成 required。
6. 按 **Add**。

連接器加好後不能改驗證設定；要換權杖就移除連接器，再加一次。

**Request headers 是 beta，只開放給部分組織。** 第 5 步看不到 **Request headers** 時，表示組織還沒有這個功能。這時網站版接不上，改用下面的「Claude 桌面版：本機橋接」或 Claude Code。

### Owner：讓 Claude 能把檔案傳回平台

Claude 在雲端的程式碼執行環境裡產出 .docx、.pptx、.html，再用 HTTP PUT 傳到平台給的上傳網址。上傳網址在 Supabase 的網域，所以要開放這個網域：

1. 到 **Organization settings → Capabilities**，確認 **Code execution and file creation** 是開的。
2. 網路存取選「套件管理器加上指定的網域」，加上 Supabase 專案的網域 `<專案代號>.supabase.co`。

有使用者回報加了網域仍然連不出去。傳不上去時，平台會給一個上傳頁連結（2 小時內有效，只能用一次），講師把 Claude 產出的檔案下載下來，在瀏覽器上傳即可。

### 講師：開始用

1. 到 **Customize → Connectors**，找到「RPAI 課程平台」，按 **Connect**。
2. 開新對話，按左下角的 **+** → **Connectors**，打開「RPAI 課程平台」。
3. 直接說要備什麼課，例如「我要備一門給業務助理的 AI 週報課，一天」。說「繼續週報課」，Claude 會從平台讀回最新藍圖，不重問。

帳號層的 `rpai-*` skill（`rpai-talk-blueprint` 等）照常可用：skill 負責怎麼談、怎麼做教材，平台負責記住結果。

### Claude 桌面版：本機橋接

組織沒有 Request headers 時，桌面版可以用本機的 MCP 設定，透過 [`mcp-remote`](https://github.com/geelen/mcp-remote) 帶 header 連到平台。電腦上要有 Node 18 以上。編輯 `claude_desktop_config.json`（**Settings → Developer → Edit Config**）：

```json
{
  "mcpServers": {
    "rpai-course-platform": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://rpai-course-platform.vercel.app/api/mcp",
        "--header",
        "Authorization:${RPAI_AUTH_HEADER}"
      ],
      "env": { "RPAI_AUTH_HEADER": "Bearer <權杖>" }
    }
  }
}
```

`Authorization:` 後面不要留空白，空白放在 `env` 的值裡（mcp-remote 的 README 說 Windows 版桌面程式不會跳脫 `args` 裡的空白）。存檔後重開桌面版。本機設定的 MCP 只在這台電腦的桌面版有效，網站版看不到。

## Claude Code

裝本 repo 的 plugin，它會連平台並帶上 runner skill 與打包的 `rpai-*` skill，安裝說明見 [`plugin/README.md`](../plugin/README.md)。

只要連平台、不裝 plugin 時：

```bash
claude mcp add --transport http rpai-course-platform https://rpai-course-platform.vercel.app/api/mcp \
  --header "Authorization: Bearer <權杖>"
```

## Codex

在 `~/.codex/config.toml` 加：

```toml
[mcp_servers.rpai-course-platform]
url = "https://rpai-course-platform.vercel.app/api/mcp"
bearer_token_env_var = "RPAI_PLATFORM_TOKEN"
```

再在啟動 Codex 的環境設定 `export RPAI_PLATFORM_TOKEN=<權杖>`。Codex 照工具描述讀寫同一份藍圖、查同一個知識庫、存回產物。`rpai-*` skill 要另外放進 Codex 讀得到的 skill 資料夾（例如 `~/.agents/skills/`）。

## 其他支援 MCP 的 AI

只要支援 Streamable HTTP 的遠端 MCP server，而且能帶自訂 header，就照上面的網址與 header 設定。備課流程寫在 MCP server 的說明（instructions）與工具描述裡，不必另外教。
