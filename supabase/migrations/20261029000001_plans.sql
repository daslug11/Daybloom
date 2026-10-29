-- Plans made with Atlas, and recurring Planner blocks.
--
-- plans               a schedule Atlas drafted (workouts, study, meals…). `sessions` is the
--                     weekly template shown on the plan card; it is edited freely while the
--                     plan is a draft and copied into block_series when the plan is added.
-- block_series        a recurring Planner block: weekly on `days`, start_date..end_date.
--                     Created by adding a plan, or by hand in the Planner.
-- series_occurrences  per-day exceptions and progress for one series: an edited time or
--                     title ("this one only"), a skipped day, or a session checked off.

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  summary text not null default '' check (char_length(summary) <= 500),
  -- What the user asked for; reused when the plan is regenerated.
  request text not null default '' check (char_length(request) <= 1000),
  weeks smallint not null check (weeks between 1 and 26),
  start_date date,
  -- [{day: 1-7 (Mon-Sun), start: minutes, duration: minutes, title, details}]
  sessions jsonb not null default '[]'::jsonb
    check (jsonb_typeof(sessions) = 'array' and jsonb_array_length(sessions) <= 21),
  status text not null default 'draft' check (status in ('draft', 'active', 'paused', 'dismissed')),
  habit_id uuid,
  goal_id uuid,
  added_at timestamptz,
  paused_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (habit_id, user_id) references public.habits (id, user_id) on delete set null (habit_id),
  foreign key (goal_id, user_id) references public.goals (id, user_id) on delete set null (goal_id)
);
create index plans_user_idx on public.plans (user_id, created_at desc);
create trigger plans_updated_at before update on public.plans
  for each row execute function public.set_updated_at();

create table public.block_series (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  plan_id uuid,
  title text not null check (char_length(title) between 1 and 300),
  details text not null default '' check (char_length(details) <= 2000),
  -- ISO weekdays: 1 = Monday … 7 = Sunday
  days smallint[] not null check (cardinality(days) between 1 and 7 and days <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[]),
  start_min smallint not null check (start_min between 0 and 1425 and start_min % 15 = 0),
  duration_min smallint not null check (duration_min between 15 and 720 and duration_min % 15 = 0),
  start_date date not null,
  end_date date not null,
  created_at timestamptz not null default now(),
  unique (id, user_id),
  check (start_min + duration_min <= 1440),
  check (end_date >= start_date and end_date <= start_date + 366),
  foreign key (plan_id, user_id) references public.plans (id, user_id) on delete set null (plan_id)
);
create index block_series_user_idx on public.block_series (user_id, end_date);
create index block_series_plan_idx on public.block_series (plan_id) where plan_id is not null;

create table public.series_occurrences (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  series_id uuid not null,
  day date not null,
  done_at timestamptz,
  skipped boolean not null default false,
  -- "This one only" overrides; null = use the series value.
  start_min smallint check (start_min between 0 and 1425 and start_min % 15 = 0),
  duration_min smallint check (duration_min between 15 and 720 and duration_min % 15 = 0),
  title text check (char_length(title) between 1 and 300),
  details text check (char_length(details) <= 2000),
  updated_at timestamptz not null default now(),
  primary key (series_id, day),
  check (start_min is null or duration_min is null or start_min + duration_min <= 1440),
  foreign key (series_id, user_id) references public.block_series (id, user_id) on delete cascade
);
create index series_occurrences_user_idx on public.series_occurrences (user_id, day);
create trigger series_occurrences_updated_at before update on public.series_occurrences
  for each row execute function public.set_updated_at();

do $$
declare t text;
begin
  foreach t in array array['plans', 'block_series', 'series_occurrences'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format(
      'create policy "own rows" on public.%I for all to authenticated
         using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
  end loop;
end $$;
