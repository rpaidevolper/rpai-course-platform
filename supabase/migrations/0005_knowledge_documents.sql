-- 0005_knowledge_documents：知識庫（#134）。全團隊共用，不屬於任何講師。
-- 開 RLS、不開 policy：只有伺服器端（service role）讀寫。
create type knowledge_kind as enum ('framework', 'module_card', 'unit_card', 'recipe');

create table knowledge_documents (
  id            uuid primary key default gen_random_uuid(),
  kind          knowledge_kind not null,
  source_key    text not null unique,      -- 來源識別的 sha256，不含客戶名稱
  modules       text[] not null default '{}',
  title         text not null,
  frontmatter   jsonb not null default '{}'::jsonb,
  body          text not null default '',  -- 去識別化後的 Markdown
  content_hash  text not null,
  flags         text[] not null default '{}',
  synced_at     timestamptz not null default now(),
  retired_at    timestamptz               -- 資料夾裡已經沒有這份文件
);

create index knowledge_documents_kind_idx on knowledge_documents (kind) where retired_at is null;

alter table knowledge_documents enable row level security;
