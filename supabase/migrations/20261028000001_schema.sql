-- Daybloom core schema: user data tables with Row Level Security.
-- Every table holds one user's rows only (user_id = auth.uid()), and links
-- between tables use composite foreign keys (id, user_id) so a row can never
-- point at another user's data.

create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- profiles (one per auth user, created by trigger)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '' check (char_length(name) <= 80),
  timezone text not null default 'UTC' check (char_length(timezone) <= 64),
  theme text not null default 'dark' check (theme in ('dark', 'light')),
  voice jsonb not null default '{}'::jsonb,
  focus_areas text[] not null default '{}' check (cardinality(focus_areas) <= 12),
  onboarded_at timestamptz,
  tour_completed_at timestamptz,
  checklist_dismissed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, name)
  values (new.id, left(coalesce(new.raw_user_meta_data ->> 'name', ''), 80))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- brain dump notes
-- ---------------------------------------------------------------------------
create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 20000),
  -- inbox: unprocessed capture · idea: kept as an idea · note: kept/reference · archived
  state text not null default 'inbox' check (state in ('inbox', 'idea', 'note', 'archived')),
  pinned boolean not null default false,
  tags text[] not null default '{}' check (cardinality(tags) <= 20),
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);
create index notes_user_state_idx on public.notes (user_id, state, created_at desc);
create index notes_body_trgm_idx on public.notes using gin (body extensions.gin_trgm_ops);
create index notes_tags_idx on public.notes using gin (tags);
create trigger notes_updated_at before update on public.notes
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- goals + milestones
-- ---------------------------------------------------------------------------
create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  emoji text not null default '🎯' check (char_length(emoji) <= 16),
  target numeric not null default 1 check (target > 0 and target < 1e12),
  current numeric not null default 0 check (current >= 0 and current < 1e12),
  unit text not null default '' check (char_length(unit) <= 40),
  due_date date,
  source_note_id uuid,
  completed_at timestamptz,
  sort double precision not null default extract(epoch from now()),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (source_note_id, user_id) references public.notes (id, user_id) on delete set null (source_note_id)
);
create index goals_user_idx on public.goals (user_id, sort);
create trigger goals_updated_at before update on public.goals
  for each row execute function public.set_updated_at();

create table public.milestones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  goal_id uuid not null,
  title text not null check (char_length(title) between 1 and 200),
  done boolean not null default false,
  sort double precision not null default extract(epoch from now()),
  created_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (goal_id, user_id) references public.goals (id, user_id) on delete cascade
);
create index milestones_goal_idx on public.milestones (goal_id, sort);

-- ---------------------------------------------------------------------------
-- tasks (also the Planner's time blocks)
-- ---------------------------------------------------------------------------
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 300),
  details text not null default '' check (char_length(details) <= 5000),
  done boolean not null default false,
  completed_at timestamptz,
  priority text check (priority in ('high', 'medium', 'low')),
  tags text[] not null default '{}' check (cardinality(tags) <= 20),
  due_date date,
  due_time time,
  estimate_min integer check (estimate_min between 1 and 1440),
  -- "Top 3 today": the date it was picked for; only counts on that date.
  top_date date,
  -- Planner time block (all three set, or none).
  sched_date date,
  sched_start integer,
  sched_duration integer,
  goal_id uuid,
  milestone_id uuid,
  parent_id uuid,
  source_note_id uuid,
  sort double precision not null default extract(epoch from now()),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  constraint tasks_schedule_complete check (
    (sched_date is null and sched_start is null and sched_duration is null)
    or (sched_date is not null and sched_start is not null and sched_duration is not null)
  ),
  constraint tasks_schedule_range check (
    sched_start is null or (
      sched_start between 0 and 1425 and sched_start % 15 = 0
      and sched_duration between 15 and 1440 and sched_duration % 15 = 0
      and sched_start + sched_duration <= 1440
    )
  ),
  foreign key (goal_id, user_id) references public.goals (id, user_id) on delete set null (goal_id),
  foreign key (milestone_id, user_id) references public.milestones (id, user_id) on delete set null (milestone_id),
  foreign key (parent_id, user_id) references public.tasks (id, user_id) on delete cascade,
  foreign key (source_note_id, user_id) references public.notes (id, user_id) on delete set null (source_note_id)
);
create index tasks_user_open_idx on public.tasks (user_id, done, due_date);
create index tasks_user_sched_idx on public.tasks (user_id, sched_date) where sched_date is not null;
create index tasks_parent_idx on public.tasks (parent_id) where parent_id is not null;
create trigger tasks_updated_at before update on public.tasks
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- habits + daily logs
-- ---------------------------------------------------------------------------
create table public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  emoji text not null default '✅' check (char_length(emoji) <= 16),
  goal_id uuid,
  source_note_id uuid,
  archived_at timestamptz,
  sort double precision not null default extract(epoch from now()),
  created_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (goal_id, user_id) references public.goals (id, user_id) on delete set null (goal_id),
  foreign key (source_note_id, user_id) references public.notes (id, user_id) on delete set null (source_note_id)
);
create index habits_user_idx on public.habits (user_id, sort);

create table public.habit_logs (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  habit_id uuid not null,
  day date not null,
  created_at timestamptz not null default now(),
  primary key (habit_id, day),
  foreign key (habit_id, user_id) references public.habits (id, user_id) on delete cascade
);
create index habit_logs_user_day_idx on public.habit_logs (user_id, day);

-- ---------------------------------------------------------------------------
-- mood check-ins (one per day)
-- ---------------------------------------------------------------------------
create table public.moods (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day date not null,
  score smallint not null check (score between 1 and 5),
  note text not null default '' check (char_length(note) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);
create trigger moods_updated_at before update on public.moods
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- focus (Pomodoro) sessions
-- ---------------------------------------------------------------------------
create table public.focus_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  task_id uuid,
  started_at timestamptz not null,
  minutes integer not null check (minutes between 1 and 240),
  created_at timestamptz not null default now(),
  foreign key (task_id, user_id) references public.tasks (id, user_id) on delete set null (task_id)
);
create index focus_sessions_user_idx on public.focus_sessions (user_id, started_at desc);

-- ---------------------------------------------------------------------------
-- calendars
-- ---------------------------------------------------------------------------
create table public.calendar_groups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  color smallint not null default 0 check (color between 0 and 7),
  sort double precision not null default extract(epoch from now()),
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.calendars (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  url text not null check (char_length(url) between 8 and 2048),
  emoji text not null default '📅' check (char_length(emoji) <= 16),
  color smallint not null default 0 check (color between 0 and 7),
  group_id uuid,
  pinned boolean not null default false,
  sync boolean not null default false,
  sort double precision not null default extract(epoch from now()),
  created_at timestamptz not null default now(),
  foreign key (group_id, user_id) references public.calendar_groups (id, user_id) on delete set null (group_id)
);
create index calendars_user_idx on public.calendars (user_id, sort);

-- ---------------------------------------------------------------------------
-- Atlas chat history and confirmations
-- ---------------------------------------------------------------------------
create table public.atlas_messages (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) <= 8000),
  -- What Atlas did during this reply: [{tool, summary, ok}]
  actions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index atlas_messages_user_idx on public.atlas_messages (user_id, id desc);

-- Destructive / big changes Atlas proposed; executed only after the user confirms.
create table public.atlas_pending_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  payload jsonb not null,
  summary text not null,
  status text not null default 'pending' check (status in ('pending', 'done', 'cancelled')),
  created_at timestamptz not null default now()
);
create index atlas_pending_user_idx on public.atlas_pending_actions (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Row Level Security: users only ever see and change their own rows
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'notes', 'goals', 'milestones', 'tasks', 'habits', 'habit_logs', 'moods',
    'focus_sessions', 'calendar_groups', 'calendars', 'atlas_messages'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format(
      'create policy "own rows" on public.%I for all to authenticated
         using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
  end loop;
end $$;

alter table public.profiles enable row level security;
revoke all on public.profiles from anon;
grant select, update on public.profiles to authenticated;
create policy "read own profile" on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy "update own profile" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Pending Atlas actions are created and executed by the server; users may only read theirs.
alter table public.atlas_pending_actions enable row level security;
revoke all on public.atlas_pending_actions from anon, authenticated;
grant select on public.atlas_pending_actions to authenticated;
create policy "read own pending actions" on public.atlas_pending_actions for select to authenticated
  using (user_id = (select auth.uid()));
