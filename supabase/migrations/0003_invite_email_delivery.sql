-- Track invite email delivery outcomes for better admin UX
-- Date: 2026-02-23

alter table public.league_invites
  add column if not exists email_delivery_status text,
  add column if not exists email_delivery_provider text,
  add column if not exists email_delivery_provider_id text,
  add column if not exists email_delivery_error text,
  add column if not exists email_sent_at timestamptz,
  add column if not exists last_delivery_attempt_at timestamptz;

alter table public.league_invites
  drop constraint if exists league_invites_email_delivery_status_check;

alter table public.league_invites
  add constraint league_invites_email_delivery_status_check
  check (
    email_delivery_status is null
    or email_delivery_status in ('sent', 'skipped', 'failed')
  );
