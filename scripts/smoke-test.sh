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

code=$(curl --silent --output /dev/null --write-out '%{http_code}' --max-time 15 "$base/login")
[ "$code" = "200" ] || fail "GET /login 回 $code，預期 200"
pass "GET /login  200"

# 沒帶登入 cookie 的 / 要導去登入頁；不跟隨轉址，只看回應的狀態碼與 Location
result=$(curl --silent --output /dev/null --write-out '%{http_code} %{redirect_url}' --max-time 15 "$base/")
code=${result%% *}
location=${result#* }
case "$code" in 3??) ;; *) fail "GET / 沒帶 cookie 回 $code，預期 3xx 導去 /login" ;; esac
case "$location" in */login*) ;; *) fail "GET / 轉址到 $location，預期含 /login" ;; esac
pass "GET /（沒帶 cookie）  $code → $location"

code=$(curl --silent --output /dev/null --write-out '%{http_code}' --max-time 15 "$base/demo")
[ "$code" = "200" ] || fail "GET /demo 回 $code，預期 200"
pass "GET /demo  200"

# 上傳頁不需要登入：沒帶 cookie 也要直接 200。這個 id 不存在，頁面會顯示連結無效
code=$(curl --silent --output /dev/null --write-out '%{http_code}' --max-time 15 "$base/u/00000000-0000-4000-8000-000000000000?t=x")
[ "$code" = "200" ] || fail "GET /u/<不存在的 id>?t=x 回 $code，預期 200（上傳頁不需要登入）"
pass "GET /u/<不存在的 id>?t=x  200（不需要登入）"

code=$(curl --silent --output /dev/null --write-out '%{http_code}' --max-time 15 \
  -X POST -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
  --data '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' "$base/api/mcp")
[ "$code" = "401" ] || fail "未帶權杖 POST /api/mcp 回 $code，預期 401"
pass "POST /api/mcp 未帶權杖  401"

echo "==> smoke test 通過"
