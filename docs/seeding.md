# Seeding Supabase

Use this to populate development/staging data for Apex League race and betting flows.

## What this seed includes

File: `supabase/seed.sql`

- 4 races in season 2026
- 16 active markets across those races
- Optional demo public league (`Apex Seed League`) if at least one auth user exists
- Optional pending invite token for invite-flow QA

## Run order

1. Apply schema migrations first:

- `supabase/migrations/0001_init.sql`
- `supabase/migrations/0002_rls_policies.sql`
- `supabase/migrations/0003_invite_email_delivery.sql`

1. Run seed:

- open Supabase SQL Editor
- paste/run `supabase/seed.sql`

The script is idempotent and safe to run multiple times.

## Important notes

- Demo league creation requires at least one row in `auth.users`.
- If `public.profiles` is empty but `auth.users` has a user, the seed auto-creates a minimal profile for league ownership.
- If no auth users exist yet, races/markets still seed successfully; league seed is skipped with a SQL notice.
- Invite token seeded for QA:
  - `/invite/77777777-7777-4777-8777-777777777777`

## Quick validation checklist

After seeding and signing in:

1. `GET /api/races` returns 2026 races
2. `GET /api/races/<raceId>/markets` returns market rows
3. `/races` page lists race cards
4. `/races/<raceId>/bets` loads markets
5. `POST /api/races/<raceId>/bets` enforces 100-token cap
