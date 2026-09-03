# RPAI Course Platform

講師教材準備後台。講師先跟 AI 談出一份**教學藍圖**，再從同一份藍圖產出課程大綱、簡報與學員手冊。

兩個部分：

| 部分 | 在哪跑 | 做什麼 |
|---|---|---|
| 後台（本 repo 的 Next.js app） | 你的伺服器 | 藍圖對話、版本管理、排產檔工作、產物下載、MCP server |
| Claude Code plugin（`plugin/`） | 講師自己的電腦 | 用 MCP 拉藍圖、用 rpai-* skill 產檔、上傳成品 |

## 開始

```bash
pnpm install
cp .env.example .env.local   # 填入 Anthropic 與 Supabase 金鑰
pnpm dev
```

資料庫：把 `supabase/migrations/` 依序套到 Supabase 專案。

替講師建立 Claude Code 權杖（後台 UI 做好前）：

```bash
pnpm token:create --user <auth.users.id> --label "Eddy 的 MacBook"
```

講師端安裝 plugin：見 `plugin/README.md`。

## 文件

- `CLAUDE.md` — 給 Claude Code 的專案規範與 skill 分工
- `docs/architecture.md` — 資料模型、產檔流程與決策記錄
- `supabase/migrations/` — 資料庫 schema
