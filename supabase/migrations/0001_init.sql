-- 0001_init：課程 / 藍圖 / 對話 / 產物
-- 設計說明見 docs/architecture.md 第 2 節。

create extension if not exists "pgcrypto";

create type artifact_kind as enum ('outline', 'slides', 'handbook');
create type artifact_status as enum ('pending', 'generating', 'ready', 'failed');
create type conversation_purpose as enum ('blueprint', 'outline', 'slides', 'handbook');

-- ---------------------------------------------------------------- courses
create table courses (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users (id) on delete cascade,
  title       text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index courses_owner_idx on courses (owner_id);

-- ------------------------------------------------------------- blueprints
-- 不可變：修改藍圖 = 新增一版。content 必須通過 BlueprintSchema.parse()。
create table blueprints (
  id           uuid primary key default gen_random_uuid(),
  course_id    uuid not null references courses (id) on delete cascade,
  version      integer not null check (version >= 1),
  content      jsonb not null,
  change_note  text,
  created_at   timestamptz not null default now(),
  unique (course_id, version)
);

-- 每門課最新一版藍圖
create view course_latest_blueprint as
  select distinct on (course_id) *
  from blueprints
  order by course_id, version desc;

-- ---------------------------------------------------- conversations / messages
create table conversations (
  id          uuid primary key default gen_random_uuid(),
  course_id   uuid not null references courses (id) on delete cascade,
  purpose     conversation_purpose not null default 'blueprint',
  created_at  timestamptz not null default now()
);

create index conversations_course_idx on conversations (course_id);

-- content 存 Anthropic content blocks 原樣（含 thinking / tool 區塊），
-- 送回 API 時不用重組。
create table messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references conversations (id) on delete cascade,
  role             text not null check (role in ('user', 'assistant')),
  content          jsonb not null,
  created_at       timestamptz not null default now()
);

create index messages_conversation_idx on messages (conversation_id, created_at);

-- -------------------------------------------------------------- artifacts
-- 每筆產物綁定生成當時的藍圖版本；藍圖升版不會自動重生，
-- 「是否過期」= artifacts.blueprint_id 不是 course_latest_blueprint.id。
create table artifacts (
  id                 uuid primary key default gen_random_uuid(),
  course_id          uuid not null references courses (id) on delete cascade,
  blueprint_id       uuid not null references blueprints (id) on delete restrict,
  kind               artifact_kind not null,
  version            integer not null check (version >= 1),
  status             artifact_status not null default 'pending',
  storage_path       text,      -- Supabase Storage 路徑，ready 之後才有
  anthropic_file_id  text,      -- 沙箱產出的原始 file id，方便追查
  error              text,
  meta               jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (course_id, kind, version)
);

create index artifacts_course_idx on artifacts (course_id, kind);

-- ------------------------------------------------------------ updated_at
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger courses_set_updated_at
  before update on courses
  for each row execute function set_updated_at();

create trigger artifacts_set_updated_at
  before update on artifacts
  for each row execute function set_updated_at();

-- ------------------------------------------------------------------- RLS
-- 只有課程 owner 可讀寫；子表透過 course_id 回查。
alter table courses        enable row level security;
alter table blueprints     enable row level security;
alter table conversations  enable row level security;
alter table messages       enable row level security;
alter table artifacts      enable row level security;

create policy courses_owner on courses
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy blueprints_owner on blueprints
  for all using (exists (select 1 from courses c where c.id = course_id and c.owner_id = auth.uid()))
  with check  (exists (select 1 from courses c where c.id = course_id and c.owner_id = auth.uid()));

create policy conversations_owner on conversations
  for all using (exists (select 1 from courses c where c.id = course_id and c.owner_id = auth.uid()))
  with check  (exists (select 1 from courses c where c.id = course_id and c.owner_id = auth.uid()));

create policy messages_owner on messages
  for all using (exists (
    select 1 from conversations v join courses c on c.id = v.course_id
    where v.id = conversation_id and c.owner_id = auth.uid()))
  with check (exists (
    select 1 from conversations v join courses c on c.id = v.course_id
    where v.id = conversation_id and c.owner_id = auth.uid()));

create policy artifacts_owner on artifacts
  for all using (exists (select 1 from courses c where c.id = course_id and c.owner_id = auth.uid()))
  with check  (exists (select 1 from courses c where c.id = course_id and c.owner_id = auth.uid()));
