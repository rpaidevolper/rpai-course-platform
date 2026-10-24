#!/bin/bash
# SessionStart hook：讓 Claude Code on the web 的新容器一開始就和專案要求的環境一致，
# 這樣 lint / typecheck / test 才跑得起來、mattpocock 的 skill 也能用。
# 本機開發者自己管環境，所以只在遠端執行。
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

# --- Node 24 -------------------------------------------------------------
# 容器預設是 Node 22，但 CI、Dev Container、Dockerfile 都用 24（改版本時要一起改）。
# 容器有 nvm 但沒裝任何版本；已裝過就不重裝，免得每次 session 都連網查新版。
NODE_MAJOR=24
export NVM_DIR="${NVM_DIR:-/opt/nvm}"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  # --no-use：不自動切到 default alias（指向未安裝的版本時會讓 set -e 直接中止）
  . "$NVM_DIR/nvm.sh" --no-use
  if ! node_path="$(nvm which "$NODE_MAJOR" 2>/dev/null)"; then
    nvm install "$NODE_MAJOR" >&2
    node_path="$(nvm which "$NODE_MAJOR")"
  fi
  node_bin="$(dirname "$node_path")"
  export PATH="$node_bin:$PATH"

  # Bash 工具用的是 session 開始時的 shell 快照，改 ~/.bashrc 沒用；
  # 寫進 CLAUDE_ENV_FILE 才會套用到之後的每個指令。resume 時 hook 會再跑一次，所以先檢查。
  if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
    path_line="export PATH=\"$node_bin:\$PATH\""
    grep -qxF "$path_line" "$CLAUDE_ENV_FILE" 2>/dev/null || echo "$path_line" >>"$CLAUDE_ENV_FILE"
  fi
else
  echo "找不到 nvm（$NVM_DIR），沿用容器預設的 Node $(node --version)" >&2
fi

# --- 依賴 ----------------------------------------------------------------
if ! command -v pnpm >/dev/null 2>&1; then
  corepack enable >/dev/null 2>&1 || npm install -g pnpm
fi

# 容器狀態會在 hook 結束後被快取，用 install（非 ci）讓 pnpm store 可重用
pnpm install --prefer-offline

# --- mattpocock-skills plugin --------------------------------------------
# .claude/settings.json 的 extraKnownMarketplaces / enabledPlugins 在雲端 session 不會自動安裝，
# 要自己裝。兩個指令都可以重複執行。失敗不擋 session，只提示手動安裝。
if claude plugin marketplace add mattpocock/skills >&2 &&
  claude plugin install mattpocock-skills@mattpocock >&2; then
  :
else
  echo "mattpocock-skills plugin 安裝失敗；請手動執行 claude plugin marketplace add mattpocock/skills && claude plugin install mattpocock-skills@mattpocock"
fi
