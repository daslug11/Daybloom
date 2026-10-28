-- AI usage accounting and limits.
-- Users can READ their own usage rows; only the server (service_role) can write,
-- and only through the SECURITY DEFINER functions below.

create table public.ai_overrides (
  user_id uuid primary key references auth.users (id) on delete cascade,
  daily_limit integer check (daily_limit between 0 and 10000),
  blocked boolean not null default false,
  updated_at timestamptz not null default now()
);

-- One row per AI request (an Atlas reply counts as one request even if it made several API calls).
create table public.usage_log (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete cascade,
  feature text not null,
  status text not null default 'started' check (status in ('started', 'ok', 'failed')),
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cost_usd numeric(12, 6) not null default 0,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index usage_log_user_time_idx on public.usage_log (user_id, created_at desc);
create index usage_log_time_idx on public.usage_log (created_at desc);

-- Per-user count of AI requests per UTC day (the daily allowance).
create table public.ai_daily_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  count integer not null default 0,
  primary key (user_id, day)
);

-- Anonymous running totals for the global spend caps. Not tied to users, so
-- deleting an account can't reset the month's spend.
create table public.ai_spend_daily (
  day date primary key,
  cost_usd numeric(14, 6) not null default 0,
  requests integer not null default 0
);

-- Cached AI results (daily briefing, weekly summary, ...).
create table public.ai_cache (
  user_id uuid not null references auth.users (id) on delete cascade,
  feature text not null,
  cache_key text not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, feature, cache_key)
);

alter table public.ai_overrides enable row level security;
alter table public.usage_log enable row level security;
alter table public.ai_daily_usage enable row level security;
alter table public.ai_spend_daily enable row level security;
alter table public.ai_cache enable row level security;

revoke all on public.ai_overrides, public.usage_log, public.ai_daily_usage, public.ai_spend_daily, public.ai_cache
  from anon, authenticated;
grant select on public.ai_overrides, public.usage_log, public.ai_daily_usage, public.ai_cache to authenticated;

create policy "read own override" on public.ai_overrides for select to authenticated
  using (user_id = (select auth.uid()));
create policy "read own usage" on public.usage_log for select to authenticated
  using (user_id = (select auth.uid()));
create policy "read own daily usage" on public.ai_daily_usage for select to authenticated
  using (user_id = (select auth.uid()));
create policy "read own cache" on public.ai_cache for select to authenticated
  using (user_id = (select auth.uid()));
-- ai_spend_daily: no policies → invisible to users.

-- ---------------------------------------------------------------------------
-- ai_begin: atomically check every limit and reserve one request.
-- Returns {ok, request_id, remaining, limit} or {ok:false, reason, ...}.
-- reason ∈ blocked | not_allowed | paused_daily | paused_monthly | rate_limited | daily_limit
-- ---------------------------------------------------------------------------
create or replace function public.ai_begin(
  p_user uuid,
  p_feature text,
  p_default_limit integer,
  p_daily_cap numeric,
  p_monthly_cap numeric,
  p_per_minute integer default 5
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_today date := (now() at time zone 'utc')::date;
  v_override public.ai_overrides%rowtype;
  v_limit integer;
  v_used integer;
  v_recent integer;
  v_oldest timestamptz;
  v_spent_today numeric;
  v_spent_month numeric;
  v_id bigint;
begin
  -- Serialize this user's checks so concurrent requests can't both slip under a limit.
  perform pg_advisory_xact_lock(hashtextextended('ai:' || p_user::text, 0));

  select * into v_override from public.ai_overrides where user_id = p_user;
  if found and v_override.blocked then
    return jsonb_build_object('ok', false, 'reason', 'blocked');
  end if;
  v_limit := coalesce(v_override.daily_limit, p_default_limit);

  select coalesce(sum(cost_usd), 0) into v_spent_today from public.ai_spend_daily where day = v_today;
  if p_daily_cap is not null and v_spent_today >= p_daily_cap then
    return jsonb_build_object('ok', false, 'reason', 'paused_daily');
  end if;
  select coalesce(sum(cost_usd), 0) into v_spent_month from public.ai_spend_daily
    where day >= date_trunc('month', v_today)::date;
  if p_monthly_cap is not null and v_spent_month >= p_monthly_cap then
    return jsonb_build_object('ok', false, 'reason', 'paused_monthly');
  end if;

  select count(*), min(created_at) into v_recent, v_oldest from public.usage_log
    where user_id = p_user and created_at > now() - interval '60 seconds';
  if v_recent >= p_per_minute then
    return jsonb_build_object('ok', false, 'reason', 'rate_limited',
      'retry_after', greatest(1, ceil(extract(epoch from (v_oldest + interval '60 seconds' - now())))::int));
  end if;

  select coalesce(count, 0) into v_used from public.ai_daily_usage where user_id = p_user and day = v_today;
  v_used := coalesce(v_used, 0);
  if v_used >= v_limit then
    return jsonb_build_object('ok', false, 'reason', 'daily_limit', 'limit', v_limit, 'remaining', 0);
  end if;

  insert into public.ai_daily_usage (user_id, day, count) values (p_user, v_today, 1)
    on conflict (user_id, day) do update set count = public.ai_daily_usage.count + 1;
  insert into public.usage_log (user_id, feature) values (p_user, left(p_feature, 40)) returning id into v_id;

  return jsonb_build_object('ok', true, 'request_id', v_id, 'limit', v_limit, 'remaining', v_limit - v_used - 1);
end $$;

-- ai_finish: record tokens/cost; on failure, give the user their request back.
create or replace function public.ai_finish(
  p_request_id bigint,
  p_input integer,
  p_output integer,
  p_cost numeric,
  p_ok boolean
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid;
  v_day date;
begin
  update public.usage_log
    set status = case when p_ok then 'ok' else 'failed' end,
        input_tokens = greatest(p_input, 0),
        output_tokens = greatest(p_output, 0),
        cost_usd = greatest(p_cost, 0),
        finished_at = now()
    where id = p_request_id and status = 'started'
    returning user_id, (created_at at time zone 'utc')::date into v_user, v_day;
  if not found then
    return;
  end if;

  if p_cost > 0 or p_ok then
    insert into public.ai_spend_daily (day, cost_usd, requests) values (v_day, greatest(p_cost, 0), 1)
      on conflict (day) do update
        set cost_usd = public.ai_spend_daily.cost_usd + excluded.cost_usd,
            requests = public.ai_spend_daily.requests + 1;
  end if;

  if not p_ok then
    update public.ai_daily_usage set count = greatest(count - 1, 0)
      where user_id = v_user and day = v_day;
  end if;
end $$;

-- ai_status: read-only view of a user's allowance and the global pause state.
create or replace function public.ai_status(
  p_user uuid,
  p_default_limit integer,
  p_daily_cap numeric,
  p_monthly_cap numeric
) returns jsonb
language plpgsql security definer set search_path = '' stable as $$
declare
  v_today date := (now() at time zone 'utc')::date;
  v_override public.ai_overrides%rowtype;
  v_limit integer;
  v_used integer;
  v_spent_today numeric;
  v_spent_month numeric;
begin
  select * into v_override from public.ai_overrides where user_id = p_user;
  v_limit := coalesce(v_override.daily_limit, p_default_limit);
  select coalesce(count, 0) into v_used from public.ai_daily_usage where user_id = p_user and day = v_today;
  select coalesce(sum(cost_usd), 0) into v_spent_today from public.ai_spend_daily where day = v_today;
  select coalesce(sum(cost_usd), 0) into v_spent_month from public.ai_spend_daily
    where day >= date_trunc('month', v_today)::date;
  return jsonb_build_object(
    'limit', v_limit,
    'used', coalesce(v_used, 0),
    'remaining', greatest(v_limit - coalesce(v_used, 0), 0),
    'blocked', coalesce(v_override.blocked, false),
    'paused', (p_daily_cap is not null and v_spent_today >= p_daily_cap)
           or (p_monthly_cap is not null and v_spent_month >= p_monthly_cap)
  );
end $$;

-- ---------------------------------------------------------------------------
-- Admin (called by the server only after checking ADMIN_EMAIL)
-- ---------------------------------------------------------------------------
create or replace function public.admin_overview(p_days integer default 30) returns jsonb
language plpgsql security definer set search_path = '' stable as $$
declare
  v_today date := (now() at time zone 'utc')::date;
  v_month date := date_trunc('month', v_today)::date;
begin
  return jsonb_build_object(
    'total_users', (select count(*) from auth.users),
    'new_users_7d', (select count(*) from auth.users where created_at > now() - interval '7 days'),
    'today', (select jsonb_build_object('requests', coalesce(sum(requests), 0), 'cost_usd', coalesce(sum(cost_usd), 0))
              from public.ai_spend_daily where day = v_today),
    'month', (select jsonb_build_object('requests', coalesce(sum(requests), 0), 'cost_usd', coalesce(sum(cost_usd), 0))
              from public.ai_spend_daily where day >= v_month),
    'daily', (select coalesce(jsonb_agg(jsonb_build_object('day', day, 'requests', requests, 'cost_usd', cost_usd) order by day), '[]'::jsonb)
              from public.ai_spend_daily where day > v_today - p_days),
    'top_users', (
      select coalesce(jsonb_agg(t order by t.cost_usd desc), '[]'::jsonb) from (
        select u.id as user_id, u.email, p.name,
               count(l.id) filter (where l.created_at >= v_today) as requests_today,
               count(l.id) as requests_month,
               coalesce(sum(l.cost_usd), 0) as cost_usd,
               o.daily_limit, coalesce(o.blocked, false) as blocked
          from public.usage_log l
          join auth.users u on u.id = l.user_id
          left join public.profiles p on p.id = u.id
          left join public.ai_overrides o on o.user_id = u.id
         where l.created_at >= v_month
         group by u.id, u.email, p.name, o.daily_limit, o.blocked
         order by cost_usd desc
         limit 25
      ) t
    )
  );
end $$;

create or replace function public.admin_find_user(p_email text) returns jsonb
language sql security definer set search_path = '' stable as $$
  select jsonb_build_object('user_id', u.id, 'email', u.email, 'name', p.name,
                            'daily_limit', o.daily_limit, 'blocked', coalesce(o.blocked, false))
    from auth.users u
    left join public.profiles p on p.id = u.id
    left join public.ai_overrides o on o.user_id = u.id
   where lower(u.email) = lower(p_email)
$$;

create or replace function public.admin_set_override(p_user uuid, p_daily_limit integer, p_blocked boolean)
returns void language sql security definer set search_path = '' as $$
  insert into public.ai_overrides (user_id, daily_limit, blocked, updated_at)
  values (p_user, p_daily_limit, p_blocked, now())
  on conflict (user_id) do update
    set daily_limit = excluded.daily_limit, blocked = excluded.blocked, updated_at = now();
$$;

-- Only the server's service role may call these.
revoke all on function public.ai_begin(uuid, text, integer, numeric, numeric, integer) from public, anon, authenticated;
revoke all on function public.ai_finish(bigint, integer, integer, numeric, boolean) from public, anon, authenticated;
revoke all on function public.ai_status(uuid, integer, numeric, numeric) from public, anon, authenticated;
revoke all on function public.admin_overview(integer) from public, anon, authenticated;
revoke all on function public.admin_find_user(text) from public, anon, authenticated;
revoke all on function public.admin_set_override(uuid, integer, boolean) from public, anon, authenticated;
grant execute on function public.ai_begin(uuid, text, integer, numeric, numeric, integer) to service_role;
grant execute on function public.ai_finish(bigint, integer, integer, numeric, boolean) to service_role;
grant execute on function public.ai_status(uuid, integer, numeric, numeric) to service_role;
grant execute on function public.admin_overview(integer) to service_role;
grant execute on function public.admin_find_user(text) to service_role;
grant execute on function public.admin_set_override(uuid, integer, boolean) to service_role;
grant all on public.ai_overrides, public.usage_log, public.ai_daily_usage, public.ai_spend_daily, public.ai_cache,
  public.atlas_pending_actions to service_role;
