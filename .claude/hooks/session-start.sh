#!/bin/bash
# SessionStart hook：讓 Claude Code on the web 的新容器一開始就裝好依賴，
# 這樣 lint / typecheck / test 才跑得起來。本機開發者自己管依賴，所以只在遠端執行。
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

if ! command -v pnpm >/dev/null 2>&1; then
  corepack enable >/dev/null 2>&1 || npm install -g pnpm
fi

# 容器狀態會在 hook 結束後被快取，用 install（非 ci）讓 pnpm store 可重用
pnpm install --prefer-offline
