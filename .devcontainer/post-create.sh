#!/bin/bash
# Dev Container 建立後執行一次：裝依賴、準備 .env.local。
set -euo pipefail

# volume 初次掛載時屬於 root
sudo chown -R "$(id -u):$(id -g)" "$HOME/.claude"

if ! command -v pnpm >/dev/null 2>&1; then
  corepack enable pnpm 2>/dev/null || sudo corepack enable pnpm
fi

pnpm install --frozen-lockfile

if [ ! -f .env.local ]; then
  cp .env.example .env.local
fi

cat <<'MSG'

開發環境已就緒。接下來：

  pnpm db:start   啟動本機 Supabase，並把連線資訊寫入 .env.local（第一次需下載映像檔，約數分鐘）
  pnpm dev        啟動後台 http://localhost:3000
  claude          啟動 Claude Code（第一次需登入）
  gh auth login   登入 GitHub

MSG
