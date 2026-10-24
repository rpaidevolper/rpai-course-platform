-- 0005_workspaces：全團隊共用一個工作區（ADR 0004、#87）
-- RLS 從「只有 owner 本人」改成「工作區成員」。owner_id 保留當「建立者」照常寫入（待決-5），不再用來授權。
-- 向下相容：只新增表與欄位、替換 policy。部署空窗裡的舊程式走 service role，不受 policy 影響；
-- 它 insert courses 時不帶 workspace_id，由 trigger 依建立者的成員資格補上。

-- ------------------------------------------------------------- workspaces
create table workspaces (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now()
);

-- 成員只由 owner 執行 `pnpm member:add` / `pnpm member:remove` 管理（service role），所以沒有寫入的 policy。
create table workspace_members (
  workspace_id  uuid not null references workspaces (id) on delete cascade,
  user_id       uuid not null references auth.users (id) on delete cascade,
  display_name  text not null,
  preferences   jsonb not null default '{}'::jsonb,  -- 講師偏好（#29）
  created_at    timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create index workspace_members_user_idx on workspace_members (user_id);

-- 所有工作區 policy 共用的判斷。security definer：policy 裡查 workspace_members 時
-- 不會再套用 workspace_members 自己的 RLS（否則會遞迴）。
create function is_workspace_member(target uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = target and user_id = auth.uid()
  );
$$;

alter table workspaces        enable row level security;
alter table workspace_members enable row level security;

create policy workspaces_member_read on workspaces
  for select using (is_workspace_member(id));

create policy workspace_members_member_read on workspace_members
  for select using (is_workspace_member(workspace_id));

-- 全團隊只有一個工作區。先建好它，既有的課程才有地方歸戶。
insert into workspaces (name) values ('RPAI 數位優化器');

-- --------------------------------------------------- courses.workspace_id
alter table courses add column workspace_id uuid references workspaces (id) on delete restrict;

update courses set workspace_id = (select id from workspaces order by created_at limit 1);

-- 沒帶 workspace_id 時，用建立者（owner_id）所屬的工作區補上。建立者不屬於恰好一個工作區時要明確指定。
-- security definer：建立者可能不是正在 insert 的人，查成員資格不能受 RLS 限制。
create function courses_fill_workspace()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  found uuid[];
begin
  if new.workspace_id is null then
    select array_agg(workspace_id) into found
    from public.workspace_members
    where user_id = new.owner_id;

    if coalesce(array_length(found, 1), 0) <> 1 then
      raise exception '課程的建立者 % 不屬於恰好一個工作區，請指定 workspace_id', new.owner_id
        using errcode = 'not_null_violation';
    end if;
    new.workspace_id := found[1];
  end if;
  return new;
end;
$$;

create trigger courses_fill_workspace
  before insert on courses
  for each row execute function courses_fill_workspace();

alter table courses alter column workspace_id set not null;

create index courses_workspace_idx on courses (workspace_id);

-- ------------------------------------------------------------------- RLS
-- owner policy 換成工作區 policy；子表透過 course_id 回查，做法和 0001 相同。api_tokens 維持只有本人。
drop policy courses_owner       on courses;
drop policy blueprints_owner    on blueprints;
drop policy conversations_owner on conversations;
drop policy messages_owner      on messages;
drop policy artifacts_owner     on artifacts;

create policy courses_workspace on courses
  for all using (is_workspace_member(workspace_id)) with check (is_workspace_member(workspace_id));

create policy blueprints_workspace on blueprints
  for all using (exists (select 1 from courses c where c.id = course_id and is_workspace_member(c.workspace_id)))
  with check  (exists (select 1 from courses c where c.id = course_id and is_workspace_member(c.workspace_id)));

create policy conversations_workspace on conversations
  for all using (exists (select 1 from courses c where c.id = course_id and is_workspace_member(c.workspace_id)))
  with check  (exists (select 1 from courses c where c.id = course_id and is_workspace_member(c.workspace_id)));

create policy messages_workspace on messages
  for all using (exists (
    select 1 from conversations v join courses c on c.id = v.course_id
    where v.id = conversation_id and is_workspace_member(c.workspace_id)))
  with check (exists (
    select 1 from conversations v join courses c on c.id = v.course_id
    where v.id = conversation_id and is_workspace_member(c.workspace_id)));

create policy artifacts_workspace on artifacts
  for all using (exists (select 1 from courses c where c.id = course_id and is_workspace_member(c.workspace_id)))
  with check  (exists (select 1 from courses c where c.id = course_id and is_workspace_member(c.workspace_id)));

-- 0001 的 view 預設以建立者（postgres）的權限執行，會繞過 blueprints 的 RLS，連 anon 都讀得到所有藍圖。
-- 改成以查詢者的權限執行，RLS 才會生效（PG 15 起支援）。
alter view course_latest_blueprint set (security_invoker = true);
