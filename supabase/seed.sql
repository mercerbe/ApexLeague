-- Apex League seed data
-- Idempotent seed for local/staging development.
-- Safe to run multiple times.

begin;

-- ------------------------------------------------------------
-- Races (2026)
-- ------------------------------------------------------------
insert into public.races (id, season, round, slug, name, country, circuit, start_time, lock_time, status)
values
  ('11111111-1111-4111-8111-111111111111', 2026, 1, '2026-australian-grand-prix', 'Australian Grand Prix', 'Australia', 'Albert Park Circuit', '2026-03-15T05:00:00Z', '2026-03-15T03:00:00Z', 'scheduled'),
  ('22222222-2222-4222-8222-222222222222', 2026, 2, '2026-japanese-grand-prix', 'Japanese Grand Prix', 'Japan', 'Suzuka Circuit', '2026-04-05T05:00:00Z', '2026-04-05T03:00:00Z', 'scheduled'),
  ('33333333-3333-4333-8333-333333333333', 2026, 3, '2026-miami-grand-prix', 'Miami Grand Prix', 'United States', 'Miami International Autodrome', '2026-05-03T20:00:00Z', '2026-05-03T18:00:00Z', 'scheduled'),
  ('44444444-4444-4444-8444-444444444444', 2026, 4, '2026-emilia-romagna-grand-prix', 'Emilia-Romagna Grand Prix', 'Italy', 'Autodromo Enzo e Dino Ferrari', '2026-05-17T13:00:00Z', '2026-05-17T11:00:00Z', 'locked')
on conflict (id) do update
set
  season = excluded.season,
  round = excluded.round,
  slug = excluded.slug,
  name = excluded.name,
  country = excluded.country,
  circuit = excluded.circuit,
  start_time = excluded.start_time,
  lock_time = excluded.lock_time,
  status = excluded.status,
  updated_at = now();

-- ------------------------------------------------------------
-- Markets for seeded races
-- ------------------------------------------------------------
insert into public.markets (
  id,
  race_id,
  provider,
  provider_market_id,
  market_type,
  selection_key,
  selection_label,
  decimal_odds,
  american_odds,
  is_active,
  fetched_at
)
values
  -- Race 1
  ('a1111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', 'odds-api-demo', 'r1-winner', 'race_winner', 'verstappen_win', 'Max Verstappen to Win', 2.35, -135, true, now()),
  ('a1111111-1111-4111-8111-111111111112', '11111111-1111-4111-8111-111111111111', 'odds-api-demo', 'r1-winner', 'race_winner', 'leclerc_win', 'Charles Leclerc to Win', 4.80, 380, true, now()),
  ('a1111111-1111-4111-8111-111111111113', '11111111-1111-4111-8111-111111111111', 'odds-api-demo', 'r1-podium', 'podium_finish', 'norris_podium', 'Lando Norris Podium Finish', 2.05, -105, true, now()),
  ('a1111111-1111-4111-8111-111111111114', '11111111-1111-4111-8111-111111111111', 'odds-api-demo', 'r1-fastest', 'fastest_lap', 'hamilton_fastest_lap', 'Lewis Hamilton Fastest Lap', 6.50, 550, true, now()),

  -- Race 2
  ('a2222222-2222-4222-8222-222222222221', '22222222-2222-4222-8222-222222222222', 'odds-api-demo', 'r2-winner', 'race_winner', 'verstappen_win', 'Max Verstappen to Win', 2.10, -110, true, now()),
  ('a2222222-2222-4222-8222-222222222222', '22222222-2222-4222-8222-222222222222', 'odds-api-demo', 'r2-winner', 'race_winner', 'norris_win', 'Lando Norris to Win', 4.20, 320, true, now()),
  ('a2222222-2222-4222-8222-222222222223', '22222222-2222-4222-8222-222222222222', 'odds-api-demo', 'r2-podium', 'podium_finish', 'russell_podium', 'George Russell Podium Finish', 2.35, 135, true, now()),
  ('a2222222-2222-4222-8222-222222222224', '22222222-2222-4222-8222-222222222222', 'odds-api-demo', 'r2-top6', 'top_6_finish', 'alonso_top6', 'Fernando Alonso Top 6', 2.80, 180, true, now()),

  -- Race 3
  ('a3333333-3333-4333-8333-333333333331', '33333333-3333-4333-8333-333333333333', 'odds-api-demo', 'r3-winner', 'race_winner', 'leclerc_win', 'Charles Leclerc to Win', 3.90, 290, true, now()),
  ('a3333333-3333-4333-8333-333333333332', '33333333-3333-4333-8333-333333333333', 'odds-api-demo', 'r3-winner', 'race_winner', 'sainz_win', 'Carlos Sainz to Win', 5.50, 450, true, now()),
  ('a3333333-3333-4333-8333-333333333333', '33333333-3333-4333-8333-333333333333', 'odds-api-demo', 'r3-podium', 'podium_finish', 'piastri_podium', 'Oscar Piastri Podium Finish', 2.15, 115, true, now()),
  ('a3333333-3333-4333-8333-333333333334', '33333333-3333-4333-8333-333333333333', 'odds-api-demo', 'r3-fastest', 'fastest_lap', 'norris_fastest_lap', 'Lando Norris Fastest Lap', 4.75, 375, true, now()),

  -- Race 4 (locked)
  ('a4444444-4444-4444-8444-444444444441', '44444444-4444-4444-8444-444444444444', 'odds-api-demo', 'r4-winner', 'race_winner', 'verstappen_win', 'Max Verstappen to Win', 2.00, -100, true, now()),
  ('a4444444-4444-4444-8444-444444444442', '44444444-4444-4444-8444-444444444444', 'odds-api-demo', 'r4-winner', 'race_winner', 'norris_win', 'Lando Norris to Win', 3.80, 280, true, now()),
  ('a4444444-4444-4444-8444-444444444443', '44444444-4444-4444-8444-444444444444', 'odds-api-demo', 'r4-podium', 'podium_finish', 'leclerc_podium', 'Charles Leclerc Podium Finish', 1.90, -111, true, now()),
  ('a4444444-4444-4444-8444-444444444444', '44444444-4444-4444-8444-444444444444', 'odds-api-demo', 'r4-top10', 'top_10_finish', 'tsunoda_top10', 'Yuki Tsunoda Top 10', 2.40, 140, true, now())
on conflict (id) do update
set
  race_id = excluded.race_id,
  provider = excluded.provider,
  provider_market_id = excluded.provider_market_id,
  market_type = excluded.market_type,
  selection_key = excluded.selection_key,
  selection_label = excluded.selection_label,
  decimal_odds = excluded.decimal_odds,
  american_odds = excluded.american_odds,
  is_active = excluded.is_active,
  fetched_at = excluded.fetched_at;

-- ------------------------------------------------------------
-- Optional demo league: created only if at least one profile exists
-- ------------------------------------------------------------
do $$
declare
  seed_owner uuid;
begin
  select p.id into seed_owner
  from public.profiles p
  order by p.created_at asc
  limit 1;

  if seed_owner is null then
    raise notice 'No profiles found. Skipping demo league seed.';
    return;
  end if;

  insert into public.leagues (id, owner_id, name, description, visibility, season)
  values (
    '55555555-5555-4555-8555-555555555555',
    seed_owner,
    'Apex Seed League',
    'Seeded public league for quick QA of joins and bets.',
    'public',
    2026
  )
  on conflict (id) do update
  set
    owner_id = excluded.owner_id,
    name = excluded.name,
    description = excluded.description,
    visibility = excluded.visibility,
    season = excluded.season,
    updated_at = now();

  insert into public.league_members (league_id, user_id, role)
  values ('55555555-5555-4555-8555-555555555555', seed_owner, 'owner')
  on conflict (league_id, user_id) do update
  set role = excluded.role,
      updated_at = now();

  insert into public.league_invites (
    id,
    league_id,
    inviter_id,
    invitee_email,
    token,
    status,
    expires_at
  )
  values (
    '66666666-6666-4666-8666-666666666666',
    '55555555-5555-4555-8555-555555555555',
    seed_owner,
    'invite-test@example.com',
    '77777777-7777-4777-8777-777777777777',
    'pending',
    now() + interval '7 days'
  )
  on conflict (id) do update
  set
    invitee_email = excluded.invitee_email,
    token = excluded.token,
    status = excluded.status,
    expires_at = excluded.expires_at;
end $$;

commit;
