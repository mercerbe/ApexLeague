-- Enrich races with optional metadata from TheSportsDB
-- Date: 2026-02-24

alter table public.races
  add column if not exists sportsdb_event_id text,
  add column if not exists venue_name text,
  add column if not exists city text,
  add column if not exists timezone text,
  add column if not exists race_description text,
  add column if not exists image_url text,
  add column if not exists banner_url text,
  add column if not exists poster_url text,
  add column if not exists highlights_url text;

create unique index if not exists idx_races_sportsdb_event_id_unique
  on public.races (sportsdb_event_id)
  where sportsdb_event_id is not null;
