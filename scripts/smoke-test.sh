#!/bin/bash
# 部署後 smoke test：確認線上的 app、資料庫與 MCP 路由都活著。
#
#   scripts/smoke-test.sh <base-url> [expected-commit]
#
# 有給 expected-commit 時，/api/health 回報的 commit 必須相同（確認線上跑的是剛部署的版本）。
# 新部署的別名切換可能有延遲，所以 health 會重試。
set -euo pipefail

base="${1:?用法：scripts/smoke-test.sh <base-url> [expected-commit]}"
base="${base%/}"
expected_commit="${2:-}"

fail() { echo "FAIL  $1" >&2; exit 1; }
pass() { echo "OK    $1"; }

echo "==> smoke test：$base"

health=""
for i in $(seq 1 20); do
  code=$(curl --silent --output /tmp/smoke-health.json --write-out '%{http_code}' --max-time 15 "$base/api/health" || true)
  health=$(cat /tmp/smoke-health.json 2>/dev/null || true)
  if [ "$code" = "200" ] && grep -q '"database":"ok"' <<<"$health" \
    && { [ -z "$expected_commit" ] || grep -q "\"commit\":\"$expected_commit\"" <<<"$health"; }; then
    break
  fi
  echo "      /api/health 尚未就緒（HTTP $code，第 $i 次）：$health"
  [ "$i" = 20 ] && fail "/api/health 沒有回 200 + database ok${expected_commit:+ + commit $expected_commit}"
  sleep 6
done
pass "/api/health  $health"

code=$(curl --silent --output /dev/null --write-out '%{http_code}' --max-time 15 "$base/")
[ "$code" = "200" ] || fail "GET / 回 $code，預期 200"
pass "GET /  200"

code=$(curl --silent --output /dev/null --write-out '%{http_code}' --max-time 15 \
  -X POST -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
  --data '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' "$base/api/mcp")
[ "$code" = "401" ] || fail "未帶權杖 POST /api/mcp 回 $code，預期 401"
pass "POST /api/mcp 未帶權杖  401"

echo "==> smoke test 通過"
