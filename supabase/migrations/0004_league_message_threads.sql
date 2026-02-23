-- Add support for threaded league messages
-- Date: 2026-02-23

alter table public.league_messages
  add column if not exists parent_message_id uuid references public.league_messages (id) on delete set null;

create index if not exists idx_league_messages_parent_created
  on public.league_messages (league_id, parent_message_id, created_at desc);
