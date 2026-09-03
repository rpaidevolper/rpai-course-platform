-- 0002_local_runner：產檔改由講師自己的 Claude Code 執行（docs/architecture.md 第 3、4 節）
-- artifacts 的 pending 列就是工作佇列；MCP 用個人存取權杖辨識講師。

create type artifact_runner as enum ('claude_code', 'cloud');

alter table artifacts
  add column runner      artifact_runner not null default 'claude_code',
  add column claimed_at  timestamptz,
  add column claimed_by  text,   -- 講師機器或 session 的標籤，方便看是誰在做
  add column filename    text;   -- 上傳時的原始檔名，下載時還原

-- ------------------------------------------------------------- api_tokens
-- 講師在後台產生一組權杖，設定到自己的 Claude Code；伺服器只存 sha256。
create table api_tokens (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references auth.users (id) on delete cascade,
  label         text not null,
  token_hash    text not null unique,
  token_prefix  text not null,   -- 前幾碼，UI 辨識用
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz,
  revoked_at    timestamptz
);

create index api_tokens_owner_idx on api_tokens (owner_id);

alter table api_tokens enable row level security;

create policy api_tokens_owner on api_tokens
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ----------------------------------------------------------------- storage
-- 產物檔案放私有 bucket，一律用 signed URL 上傳／下載。
insert into storage.buckets (id, name, public)
values ('artifacts', 'artifacts', false)
on conflict (id) do nothing;
