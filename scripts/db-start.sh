#!/bin/bash
# 啟動本機 Supabase（需要 Docker），套用 supabase/migrations/，並把連線資訊寫入 .env.local。
set -euo pipefail

cd "$(dirname "$0")/.."

pnpm exec supabase start

status=$(pnpm exec supabase status -o env 2>/dev/null)
value_of() {
  # status 輸出為 KEY="value"
  sed -n "s/^$1=\"\{0,1\}\([^\"]*\)\"\{0,1\}\$/\1/p" <<<"$status" | head -n 1
}

api_url=$(value_of API_URL)
anon_key=$(value_of ANON_KEY)
service_role_key=$(value_of SERVICE_ROLE_KEY)
# 較新的 CLI 以 publishable / secret key 取代 anon / service_role
[ -n "$anon_key" ] || anon_key=$(value_of PUBLISHABLE_KEY)
[ -n "$service_role_key" ] || service_role_key=$(value_of SECRET_KEY)

if [ -z "$api_url" ] || [ -z "$anon_key" ] || [ -z "$service_role_key" ]; then
  echo "無法從 supabase status 取得連線資訊，取得的變數：" >&2
  sed 's/=.*//' <<<"$status" >&2
  exit 1
fi

[ -f .env.local ] || cp .env.example .env.local

set_env() {
  local tmp
  tmp=$(mktemp)
  grep -v "^$1=" .env.local >"$tmp" || true
  echo "$1=$2" >>"$tmp"
  mv "$tmp" .env.local
}
set_env NEXT_PUBLIC_SUPABASE_URL "$api_url"
set_env NEXT_PUBLIC_SUPABASE_ANON_KEY "$anon_key"
set_env SUPABASE_SERVICE_ROLE_KEY "$service_role_key"

echo
echo "本機 Supabase 已啟動，連線資訊已寫入 .env.local"
echo "  API     $api_url"
echo "  Studio  http://127.0.0.1:54323"
