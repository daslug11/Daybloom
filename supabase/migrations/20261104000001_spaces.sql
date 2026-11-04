-- Spaces: custom sections (a Christmas list, a running log, college applications…)
-- built from a fixed set of building blocks. See shared/spaces/blocks.ts.
--
-- spaces           one Space: its design (fields, views, summary cards) as JSON, plus
--                  settings, an optional linked habit and goal, and a status.
-- space_items      the rows in a Space. `data` holds field values keyed by field key;
--                  `meta` holds fetched link previews.
-- space_templates  Spaces a user saved as their own templates.
-- space_shares     an optional read-only share link per Space (a long random token).
-- link_previews    a server-only cache of fetched link titles, images and prices.
--
-- Limits (also enforced in the app): 25 active Spaces, 15 fields, 3 views, 6 summary
-- cards, 8 status options, 5,000 items per Space, 50 saved templates.

-- ---------------------------------------------------------------------------
-- spaces
-- ---------------------------------------------------------------------------
create or replace function public.space_design_ok(d jsonb) returns boolean
language sql immutable as $$
  select jsonb_typeof(d) = 'object'
    and jsonb_typeof(coalesce(d -> 'fields', '[]')) = 'array'
    and jsonb_array_length(coalesce(d -> 'fields', '[]')) between 1 and 15
    and jsonb_array_length(coalesce(d -> 'views', '[]')) <= 3
    and jsonb_array_length(coalesce(d -> 'summaries', '[]')) <= 6
    and not exists (
      select 1 from jsonb_array_elements(coalesce(d -> 'fields', '[]')) f
      where jsonb_array_length(coalesce(f -> 'options', '[]')) > 8
    )
    and pg_column_size(d) <= 32000
$$;

create table public.spaces (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  emoji text not null default '✨' check (char_length(emoji) <= 16),
  color smallint not null default 0 check (color between 0 and 7),
  description text not null default '' check (char_length(description) <= 300),
  design jsonb not null check (public.space_design_ok(design)),
  -- planner_field, reminder_field, reminder_days, pinned, view (see SpaceSettings)
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object' and pg_column_size(settings) <= 4000),
  -- draft: made by Atlas, waiting in its preview · active · archived (doesn't count toward the 25)
  status text not null default 'active' check (status in ('draft', 'active', 'archived')),
  -- What the user asked for (reused by ✨ Redesign).
  request text not null default '' check (char_length(request) <= 1000),
  habit_id uuid,
  goal_id uuid,
  -- Which field adds to the goal; null = each item counts 1.
  goal_field text check (char_length(goal_field) <= 24),
  template_id text check (char_length(template_id) <= 40),
  sort double precision not null default extract(epoch from now()),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (habit_id, user_id) references public.habits (id, user_id) on delete set null (habit_id),
  foreign key (goal_id, user_id) references public.goals (id, user_id) on delete set null (goal_id)
);
create index spaces_user_idx on public.spaces (user_id, status, sort);
create trigger spaces_updated_at before update on public.spaces
  for each row execute function public.set_updated_at();

create or replace function public.spaces_limit() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.status = 'active' and (tg_op = 'INSERT' or old.status <> 'active') then
    if (select count(*) from public.spaces where user_id = new.user_id and status = 'active' and id <> new.id) >= 25 then
      raise exception 'You can have up to 25 active Spaces. Archive one to make room.' using errcode = 'P0001', hint = 'space_limit';
    end if;
  end if;
  if new.status = 'draft' and tg_op = 'INSERT' then
    -- Atlas drafts nobody opened don't pile up.
    delete from public.spaces where user_id = new.user_id and status = 'draft' and created_at < now() - interval '7 days';
    if (select count(*) from public.spaces where user_id = new.user_id and status = 'draft') >= 20 then
      raise exception 'Too many unsaved Space previews. Save or discard some first.' using errcode = 'P0001', hint = 'draft_limit';
    end if;
  end if;
  return new;
end $$;
create trigger spaces_limit before insert or update of status on public.spaces
  for each row execute function public.spaces_limit();

-- ---------------------------------------------------------------------------
-- space_items
-- ---------------------------------------------------------------------------
create table public.space_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  space_id uuid not null,
  data jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object' and pg_column_size(data) <= 24000),
  meta jsonb not null default '{}'::jsonb check (jsonb_typeof(meta) = 'object' and pg_column_size(meta) <= 8000),
  position double precision not null default extract(epoch from clock_timestamp()),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (space_id, user_id) references public.spaces (id, user_id) on delete cascade
);
create index space_items_space_idx on public.space_items (space_id, position);
create index space_items_user_idx on public.space_items (user_id);
create trigger space_items_updated_at before update on public.space_items
  for each row execute function public.set_updated_at();

create or replace function public.space_items_limit() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if (select count(*) from public.space_items where space_id = new.space_id) >= 5000 then
    raise exception 'This Space is full (5,000 items). Start a new one or remove some.' using errcode = 'P0001', hint = 'item_limit';
  end if;
  return new;
end $$;
create trigger space_items_limit before insert on public.space_items
  for each row execute function public.space_items_limit();

-- Logging an item counts toward the Space's linked habit and goal, whoever added it
-- (the app, a paste, Atlas). Deleting an item takes its amount back off the goal.
create or replace function public.space_item_amount(d jsonb, design jsonb, goal_field text) returns numeric
language plpgsql immutable set search_path = '' as $$
declare
  ftype text;
  v jsonb;
begin
  if goal_field is null then return 1; end if;
  select f ->> 'type' into ftype from jsonb_array_elements(design -> 'fields') f where f ->> 'key' = goal_field limit 1;
  v := d -> goal_field;
  if ftype is null or v is null then return 0; end if;
  if ftype = 'checkbox' then return case when v = 'true'::jsonb then 1 else 0 end; end if;
  if jsonb_typeof(v) <> 'number' then return 0; end if;
  -- Durations are stored in seconds; goals count them in minutes.
  if ftype = 'duration' then return round((v #>> '{}')::numeric / 60, 2); end if;
  return (v #>> '{}')::numeric;
end $$;

create or replace function public.space_items_count_toward() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare
  s record;
  today date;
  d date;
  date_key text;
  delta numeric := 0;
begin
  select sp.habit_id, sp.goal_id, sp.goal_field, sp.design, sp.status into s
    from public.spaces sp where sp.id = coalesce(new.space_id, old.space_id);
  -- Gone (the whole Space is being deleted) or a preview: nothing to count.
  if not found or s.status = 'draft' then return null; end if;

  if tg_op = 'INSERT' and s.habit_id is not null then
    select (now() at time zone coalesce(p.timezone, 'UTC'))::date into today from public.profiles p where p.id = new.user_id;
    today := coalesce(today, current_date);
    select f ->> 'key' into date_key from jsonb_array_elements(s.design -> 'fields') f
      where f ->> 'type' = 'date' and new.data ? (f ->> 'key') limit 1;
    begin
      d := coalesce((new.data ->> date_key)::date, today);
    exception when others then
      d := today;
    end;
    if d <= today then
      insert into public.habit_logs (user_id, habit_id, day) values (new.user_id, s.habit_id, d)
        on conflict (habit_id, day) do nothing;
    end if;
  end if;

  if s.goal_id is not null then
    if tg_op in ('INSERT', 'UPDATE') then delta := delta + public.space_item_amount(new.data, s.design, s.goal_field); end if;
    if tg_op in ('DELETE', 'UPDATE') then delta := delta - public.space_item_amount(old.data, s.design, s.goal_field); end if;
    if delta <> 0 then
      update public.goals g
        set current = greatest(0, least(g.current + delta, 999999999999)),
            completed_at = case when greatest(0, g.current + delta) >= g.target then coalesce(g.completed_at, now()) else null end
        where g.id = s.goal_id;
    end if;
  end if;
  return null;
end $$;
create trigger space_items_count_toward after insert or update of data or delete on public.space_items
  for each row execute function public.space_items_count_toward();

-- ---------------------------------------------------------------------------
-- space_templates (a user's own)
-- ---------------------------------------------------------------------------
create table public.space_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  emoji text not null default '✨' check (char_length(emoji) <= 16),
  color smallint not null default 0 check (color between 0 and 7),
  description text not null default '' check (char_length(description) <= 300),
  design jsonb not null check (public.space_design_ok(design)),
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object' and pg_column_size(settings) <= 4000),
  created_at timestamptz not null default now()
);
create index space_templates_user_idx on public.space_templates (user_id, created_at desc);

create or replace function public.space_templates_limit() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if (select count(*) from public.space_templates where user_id = new.user_id) >= 50 then
    raise exception 'You can save up to 50 templates. Delete one to make room.' using errcode = 'P0001', hint = 'template_limit';
  end if;
  return new;
end $$;
create trigger space_templates_limit before insert on public.space_templates
  for each row execute function public.space_templates_limit();

-- ---------------------------------------------------------------------------
-- space_shares: read-only links. Owners manage them here; visitors read them only
-- through /api/spaces, which returns the Space without private fields or account info.
-- ---------------------------------------------------------------------------
create table public.space_shares (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  space_id uuid not null unique,
  -- 64 hex characters from two random UUIDs (about 244 random bits).
  token text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
    check (char_length(token) >= 48),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (space_id, user_id) references public.spaces (id, user_id) on delete cascade
);
create trigger space_shares_updated_at before update on public.space_shares
  for each row execute function public.set_updated_at();

-- Owners can turn a link on/off or delete it, never choose its token.
create or replace function public.space_shares_token_guard() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  elsif new.token <> old.token then
    raise exception 'Share tokens cannot be changed.' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger space_shares_token_guard before insert or update on public.space_shares
  for each row execute function public.space_shares_token_guard();

-- ---------------------------------------------------------------------------
-- link_previews: server-only cache (no access for signed-in users or visitors)
-- ---------------------------------------------------------------------------
create table public.link_previews (
  url_hash text primary key,
  url text not null check (char_length(url) <= 2000),
  data jsonb not null default '{}'::jsonb check (pg_column_size(data) <= 4000),
  fetched_at timestamptz not null default now()
);
alter table public.link_previews enable row level security;
revoke all on public.link_previews from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security: users only ever see and change their own rows
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['spaces', 'space_items', 'space_templates', 'space_shares'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format(
      'create policy "own rows" on public.%I for all to authenticated
         using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Storage: uploaded images for image fields. Private bucket; each user can only
-- touch files under a folder named after their own user id. 2 MB per file, images only.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('space-images', 'space-images', false, 2097152, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "space images: read own" on storage.objects;
drop policy if exists "space images: add own" on storage.objects;
drop policy if exists "space images: change own" on storage.objects;
drop policy if exists "space images: delete own" on storage.objects;
create policy "space images: read own" on storage.objects for select to authenticated
  using (bucket_id = 'space-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "space images: add own" on storage.objects for insert to authenticated
  with check (bucket_id = 'space-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "space images: change own" on storage.objects for update to authenticated
  using (bucket_id = 'space-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "space images: delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'space-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
