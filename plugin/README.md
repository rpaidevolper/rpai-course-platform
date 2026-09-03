# RPAI Course Platform plugin

讓講師在**自己的 Claude Code** 裡產出後台排下來的教材：大綱、簡報、學員手冊。
用講師自己的 Claude 訂閱、吃自己的電腦，平台只負責藍圖與檔案登記。

## 安裝

```bash
claude plugin marketplace add rpaidevolper/rpai-course-platform
claude plugin install rpai-course-platform@rpai
```

安裝時會問兩個設定：

| 設定 | 內容 |
|---|---|
| `server_url` | 平台網址，例如 `https://course.rpai.tw`（不含結尾斜線） |
| `api_token` | 在平台「設定 → Claude Code 權杖」產生的 `rcp_` 開頭權杖 |

裝好後在 Claude Code 裡說「有沒有待生成的教材」或 `/rpai-platform-runner` 就會開始跑。

## 內容

```
plugin/
├── .claude-plugin/plugin.json   # 名稱、版本、安裝時要問的設定
├── .mcp.json                    # 連到平台的 MCP server（/api/mcp）
└── skills/
    ├── rpai-platform-runner/    # 串流程：拉藍圖 → 產檔 → 上傳
    ├── rpai-talk-blueprint/     # 以下五個是打包進來的 RPAI 內容 skill
    ├── rpai-course-outline/
    ├── rpai-course-content/
    ├── rpai-pptx-workflow/
    └── rpai-brand-guidelines/
```

`pptx`、`docx` skill 用的是 Claude Code 內建的，不用另外裝。

## 已經有帳號層 rpai-* skill 的人

RPAI 帳號成員的 Claude Code 本來就同步了 `rpai-*` skill。plugin 內的版本會以
`rpai-course-platform:rpai-pptx-workflow` 這種名稱出現，兩邊內容相同，觸發到哪一個都可以。
之後要改 skill 內容，以本 repo 的 `plugin/skills/` 為準，再同步回帳號層。

## 開發

```bash
claude --plugin-dir ./plugin
```

只載入這個 session，不會寫進設定。本機開發時 `server_url` 填 `http://localhost:3000`。
