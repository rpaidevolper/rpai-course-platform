#!/bin/bash
# 把 repo 設定、labels、main ruleset 套用到 GitHub。可重複執行，結果以 .github/ 下的設定檔為準。
# 需要 repo owner 權限：gh auth switch -u rpaidevolper
#
#   scripts/setup-github.sh                      套用完整設定
#   scripts/setup-github.sh --without-ai-review  ruleset 不要求 ai-review（Claude 憑證未設定或服務中斷時用）
set -euo pipefail

without_ai_review=false
for arg in "$@"; do
  case "$arg" in
    --without-ai-review) without_ai_review=true ;;
    *) echo "未知參數：$arg" >&2; exit 2 ;;
  esac
done

cd "$(dirname "$0")/.."
repo=$(gh repo view --json nameWithOwner --jq .nameWithOwner)
echo "==> $repo"

echo "==> Repo 設定：只允許 squash merge，合併後刪分支"
gh api -X PATCH "repos/$repo" \
  -F allow_squash_merge=true \
  -F allow_merge_commit=false \
  -F allow_rebase_merge=false \
  -F delete_branch_on_merge=true \
  -f squash_merge_commit_title=PR_TITLE \
  -f squash_merge_commit_message=PR_BODY \
  --silent

echo "==> Labels"
wanted=$(jq -r '.[].name' .github/labels.json)
jq -c '.[]' .github/labels.json | while read -r label; do
  gh label create "$(jq -r .name <<<"$label")" \
    --repo "$repo" \
    --color "$(jq -r .color <<<"$label")" \
    --description "$(jq -r .description <<<"$label")" \
    --force >/dev/null
done
gh label list --repo "$repo" --limit 200 --json name --jq '.[].name' | while read -r existing; do
  if ! grep -Fxq "$existing" <<<"$wanted"; then
    echo "    刪除不在清單中的 label：$existing"
    gh label delete "$existing" --repo "$repo" --yes
  fi
done

echo "==> Ruleset：main"
ruleset=$(cat .github/rulesets/main.json)
if $without_ai_review; then
  echo "    （不要求 ai-review）"
  ruleset=$(jq '(.rules[] | select(.type == "required_status_checks") | .parameters.required_status_checks)
    |= map(select(.context != "ai-review"))' <<<"$ruleset")
fi
name=$(jq -r .name <<<"$ruleset")
id=$(gh api "repos/$repo/rulesets" --jq ".[] | select(.name == \"$name\") | .id")
if [ -n "$id" ]; then
  gh api -X PUT "repos/$repo/rulesets/$id" --input - <<<"$ruleset" --silent
else
  gh api -X POST "repos/$repo/rulesets" --input - <<<"$ruleset" --silent
fi

echo "==> 完成"
