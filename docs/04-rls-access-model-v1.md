# RLS Access Model v1

Date: 2026-02-22
Migration: `supabase/migrations/0002_rls_policies.sql`

## Summary
- Public reads allowed for race/news primitives: `races`, `markets`, `race_results`, `race_league_winners`, `news_articles`.
- League data is member-scoped except public league discovery.
- Mutations are restricted to owner/admin or the record owner (`auth.uid()`) depending on table.
- Bets are immutable by end users after insertion.

## Table Rules
- `profiles`: authenticated read, self insert/update.
- `leagues`: public rows readable by anyone; private rows readable by members; owner/admin mutate.
- `league_members`: visible to members in same league; self-join on public leagues; admin-managed updates.
- `league_invites`: visible to league admin/owner and invitee email match; admin creates.
- `bets`: user or league members can read; only betting user can insert before race lock and only if in league.
- `league_messages`: members can read/write their own messages.
- `notifications`: self read/update only.
- `push_subscriptions`: self read/write/delete only.

## Helper Functions
- `public.is_league_member(uuid)`
- `public.is_league_admin(uuid)`
- `public.is_league_owner(uuid)`

All three are `SECURITY DEFINER` and executable by authenticated users.

## Notes
- Service-role operations (settlement, ingestion, background jobs) bypass RLS as expected in Supabase.
- Stake budget cap (`<=100` per race) remains an application/transaction rule enforced in API logic.
