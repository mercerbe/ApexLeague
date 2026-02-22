-- Apex League initial schema
-- Date: 2026-02-22

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- Utility
-- ------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ------------------------------------------------------------
-- Profiles
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  handle text unique,
  bio text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_handle_length check (handle is null or char_length(handle) between 3 and 24)
);

create trigger trg_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

-- ------------------------------------------------------------
-- Races
-- ------------------------------------------------------------
create table if not exists public.races (
  id uuid primary key default gen_random_uuid(),
  season int not null,
  round int not null,
  slug text not null unique,
  name text not null,
  country text,
  circuit text,
  start_time timestamptz not null,
  lock_time timestamptz not null,
  status text not null default 'scheduled',
  result_revision int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint races_status_check check (status in ('scheduled', 'locked', 'settling', 'settled')),
  constraint races_lock_before_start check (lock_time <= start_time),
  constraint races_season_round_unique unique (season, round)
);

create index if not exists idx_races_status_start_time on public.races (status, start_time);

create trigger trg_races_updated_at
before update on public.races
for each row
execute function public.set_updated_at();

-- ------------------------------------------------------------
-- Markets
-- ------------------------------------------------------------
create table if not exists public.markets (
  id uuid primary key default gen_random_uuid(),
  race_id uuid not null references public.races (id) on delete cascade,
  provider text not null,
  provider_market_id text not null,
  market_type text not null,
  selection_key text not null,
  selection_label text not null,
  decimal_odds numeric(10,4) not null,
  american_odds int,
  is_active boolean not null default true,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint markets_decimal_odds_check check (decimal_odds > 1.0),
  constraint markets_provider_unique unique (provider, provider_market_id, selection_key)
);

create index if not exists idx_markets_race_active on public.markets (race_id, is_active);

-- ------------------------------------------------------------
-- Leagues and membership
-- ------------------------------------------------------------
create table if not exists public.leagues (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete restrict,
  name text not null,
  description text,
  icon_url text,
  visibility text not null default 'private',
  max_members int,
  season int not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint leagues_visibility_check check (visibility in ('public', 'private')),
  constraint leagues_max_members_check check (max_members is null or max_members >= 2)
);

create index if not exists idx_leagues_visibility on public.leagues (visibility);

create trigger trg_leagues_updated_at
before update on public.leagues
for each row
execute function public.set_updated_at();

create table if not exists public.league_members (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member',
  season_points numeric(12,4) not null default 0,
  joined_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint league_members_role_check check (role in ('owner', 'admin', 'member')),
  constraint league_members_unique unique (league_id, user_id)
);

create index if not exists idx_league_members_league_points on public.league_members (league_id, season_points desc);
create index if not exists idx_league_members_user on public.league_members (user_id);

create trigger trg_league_members_updated_at
before update on public.league_members
for each row
execute function public.set_updated_at();

create table if not exists public.league_invites (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues (id) on delete cascade,
  inviter_id uuid not null references public.profiles (id) on delete restrict,
  invitee_email text not null,
  token text not null unique,
  status text not null default 'pending',
  expires_at timestamptz not null,
  accepted_by_user_id uuid references public.profiles (id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  constraint league_invites_status_check check (status in ('pending', 'accepted', 'expired', 'revoked'))
);

create index if not exists idx_league_invites_league_status on public.league_invites (league_id, status);
create index if not exists idx_league_invites_email on public.league_invites (lower(invitee_email));

-- ------------------------------------------------------------
-- Bets and settlement
-- ------------------------------------------------------------
create table if not exists public.bets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  league_id uuid not null references public.leagues (id) on delete cascade,
  race_id uuid not null references public.races (id) on delete cascade,
  market_id uuid not null references public.markets (id) on delete restrict,
  selection_key text not null,
  stake numeric(10,2) not null,
  decimal_odds_snapshot numeric(10,4) not null,
  status text not null default 'pending',
  gross_return numeric(12,4),
  net_profit numeric(12,4),
  settled_at timestamptz,
  placed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint bets_stake_check check (stake > 0 and stake <= 100),
  constraint bets_odds_snapshot_check check (decimal_odds_snapshot > 1.0),
  constraint bets_status_check check (status in ('pending', 'won', 'lost', 'void'))
);

create index if not exists idx_bets_user_race on public.bets (user_id, race_id);
create index if not exists idx_bets_league_race on public.bets (league_id, race_id);
create index if not exists idx_bets_pending_race on public.bets (race_id) where status = 'pending';

create table if not exists public.race_results (
  id uuid primary key default gen_random_uuid(),
  race_id uuid not null references public.races (id) on delete cascade,
  result_key text not null,
  result_value text not null,
  source text not null,
  revision int not null default 1,
  created_at timestamptz not null default now(),
  constraint race_results_unique unique (race_id, result_key, revision)
);

create index if not exists idx_race_results_race_revision on public.race_results (race_id, revision desc);

create table if not exists public.race_league_winners (
  id uuid primary key default gen_random_uuid(),
  race_id uuid not null references public.races (id) on delete cascade,
  league_id uuid not null references public.leagues (id) on delete cascade,
  winner_user_id uuid not null references public.profiles (id) on delete cascade,
  race_points numeric(12,4) not null,
  created_at timestamptz not null default now(),
  constraint race_league_winners_unique unique (race_id, league_id)
);

-- ------------------------------------------------------------
-- Social / notifications
-- ------------------------------------------------------------
create table if not exists public.league_messages (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  constraint league_messages_body_check check (char_length(body) between 1 and 1000)
);

create index if not exists idx_league_messages_league_created on public.league_messages (league_id, created_at desc);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_user_created on public.notifications (user_id, created_at desc);

create table if not exists public.news_articles (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  external_id text,
  title text not null,
  summary text,
  url text not null,
  image_url text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  constraint news_articles_source_external_unique unique (source, external_id)
);

create index if not exists idx_news_articles_published_at on public.news_articles (published_at desc);

-- ------------------------------------------------------------
-- Web push subscriptions
-- ------------------------------------------------------------
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_push_subscriptions_user on public.push_subscriptions (user_id);

create trigger trg_push_subscriptions_updated_at
before update on public.push_subscriptions
for each row
execute function public.set_updated_at();

-- ------------------------------------------------------------
-- RLS enabled now; policies added in next migration
-- ------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.races enable row level security;
alter table public.markets enable row level security;
alter table public.leagues enable row level security;
alter table public.league_members enable row level security;
alter table public.league_invites enable row level security;
alter table public.bets enable row level security;
alter table public.race_results enable row level security;
alter table public.race_league_winners enable row level security;
alter table public.league_messages enable row level security;
alter table public.notifications enable row level security;
alter table public.news_articles enable row level security;
alter table public.push_subscriptions enable row level security;
