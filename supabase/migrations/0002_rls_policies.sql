-- Apex League RLS policies
-- Date: 2026-02-22

-- ------------------------------------------------------------
-- Helper authorization functions
-- ------------------------------------------------------------
create or replace function public.is_league_member(target_league_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.league_members lm
    where lm.league_id = target_league_id
      and lm.user_id = auth.uid()
  );
$$;

create or replace function public.is_league_admin(target_league_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.league_members lm
    where lm.league_id = target_league_id
      and lm.user_id = auth.uid()
      and lm.role in ('owner', 'admin')
  );
$$;

create or replace function public.is_league_owner(target_league_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.leagues l
    where l.id = target_league_id
      and l.owner_id = auth.uid()
  );
$$;

revoke all on function public.is_league_member(uuid) from public;
revoke all on function public.is_league_admin(uuid) from public;
revoke all on function public.is_league_owner(uuid) from public;
grant execute on function public.is_league_member(uuid) to authenticated;
grant execute on function public.is_league_admin(uuid) to authenticated;
grant execute on function public.is_league_owner(uuid) to authenticated;

-- ------------------------------------------------------------
-- Profiles
-- ------------------------------------------------------------
drop policy if exists profiles_select_authenticated on public.profiles;
create policy profiles_select_authenticated
on public.profiles
for select
to authenticated
using (true);

drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self
on public.profiles
for insert
to authenticated
with check (id = auth.uid());

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- ------------------------------------------------------------
-- Races / Markets / Results / News
-- ------------------------------------------------------------
drop policy if exists races_select_public on public.races;
create policy races_select_public
on public.races
for select
to anon, authenticated
using (true);

drop policy if exists markets_select_public on public.markets;
create policy markets_select_public
on public.markets
for select
to anon, authenticated
using (true);

drop policy if exists race_results_select_public on public.race_results;
create policy race_results_select_public
on public.race_results
for select
to anon, authenticated
using (true);

drop policy if exists race_league_winners_select_public on public.race_league_winners;
create policy race_league_winners_select_public
on public.race_league_winners
for select
to anon, authenticated
using (true);

drop policy if exists news_articles_select_public on public.news_articles;
create policy news_articles_select_public
on public.news_articles
for select
to anon, authenticated
using (true);

-- ------------------------------------------------------------
-- Leagues
-- ------------------------------------------------------------
drop policy if exists leagues_select_member_or_public on public.leagues;
create policy leagues_select_member_or_public
on public.leagues
for select
to anon, authenticated
using (
  visibility = 'public'
  or public.is_league_member(id)
);

drop policy if exists leagues_insert_owner on public.leagues;
create policy leagues_insert_owner
on public.leagues
for insert
to authenticated
with check (owner_id = auth.uid());

drop policy if exists leagues_update_owner_or_admin on public.leagues;
create policy leagues_update_owner_or_admin
on public.leagues
for update
to authenticated
using (public.is_league_admin(id) or public.is_league_owner(id))
with check (public.is_league_admin(id) or public.is_league_owner(id));

drop policy if exists leagues_delete_owner on public.leagues;
create policy leagues_delete_owner
on public.leagues
for delete
to authenticated
using (public.is_league_owner(id));

-- ------------------------------------------------------------
-- League members
-- ------------------------------------------------------------
drop policy if exists league_members_select_same_league on public.league_members;
create policy league_members_select_same_league
on public.league_members
for select
to authenticated
using (public.is_league_member(league_id));

drop policy if exists league_members_insert_self_public_or_admin on public.league_members;
create policy league_members_insert_self_public_or_admin
on public.league_members
for insert
to authenticated
with check (
  user_id = auth.uid()
  and (
    exists (
      select 1
      from public.leagues l
      where l.id = league_id
        and l.visibility = 'public'
    )
    or public.is_league_admin(league_id)
    or public.is_league_owner(league_id)
  )
);

drop policy if exists league_members_update_admin_only on public.league_members;
create policy league_members_update_admin_only
on public.league_members
for update
to authenticated
using (public.is_league_admin(league_id) or public.is_league_owner(league_id))
with check (public.is_league_admin(league_id) or public.is_league_owner(league_id));

drop policy if exists league_members_delete_self_or_admin on public.league_members;
create policy league_members_delete_self_or_admin
on public.league_members
for delete
to authenticated
using (user_id = auth.uid() or public.is_league_admin(league_id) or public.is_league_owner(league_id));

-- ------------------------------------------------------------
-- League invites
-- ------------------------------------------------------------
drop policy if exists league_invites_select_admin_or_invitee on public.league_invites;
create policy league_invites_select_admin_or_invitee
on public.league_invites
for select
to authenticated
using (
  public.is_league_admin(league_id)
  or public.is_league_owner(league_id)
  or lower(invitee_email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
);

drop policy if exists league_invites_insert_admin_only on public.league_invites;
create policy league_invites_insert_admin_only
on public.league_invites
for insert
to authenticated
with check (
  inviter_id = auth.uid()
  and (public.is_league_admin(league_id) or public.is_league_owner(league_id))
);

drop policy if exists league_invites_update_admin_or_invitee_accept on public.league_invites;
create policy league_invites_update_admin_or_invitee_accept
on public.league_invites
for update
to authenticated
using (
  public.is_league_admin(league_id)
  or public.is_league_owner(league_id)
  or lower(invitee_email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
)
with check (
  public.is_league_admin(league_id)
  or public.is_league_owner(league_id)
  or (
    lower(invitee_email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
    and accepted_by_user_id = auth.uid()
  )
);

-- ------------------------------------------------------------
-- Bets
-- ------------------------------------------------------------
drop policy if exists bets_select_self_or_league_member on public.bets;
create policy bets_select_self_or_league_member
on public.bets
for select
to authenticated
using (user_id = auth.uid() or public.is_league_member(league_id));

drop policy if exists bets_insert_member_and_owner on public.bets;
create policy bets_insert_member_and_owner
on public.bets
for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.is_league_member(league_id)
  and exists (
    select 1
    from public.races r
    where r.id = race_id
      and r.status = 'scheduled'
      and now() < r.lock_time
  )
);

-- No user-facing updates/deletes to bets after placement.

-- ------------------------------------------------------------
-- League chat
-- ------------------------------------------------------------
drop policy if exists league_messages_select_member_only on public.league_messages;
create policy league_messages_select_member_only
on public.league_messages
for select
to authenticated
using (public.is_league_member(league_id));

drop policy if exists league_messages_insert_member_only on public.league_messages;
create policy league_messages_insert_member_only
on public.league_messages
for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.is_league_member(league_id)
);

-- ------------------------------------------------------------
-- Notifications
-- ------------------------------------------------------------
drop policy if exists notifications_select_self on public.notifications;
create policy notifications_select_self
on public.notifications
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists notifications_update_self on public.notifications;
create policy notifications_update_self
on public.notifications
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- ------------------------------------------------------------
-- Push subscriptions
-- ------------------------------------------------------------
drop policy if exists push_subscriptions_select_self on public.push_subscriptions;
create policy push_subscriptions_select_self
on public.push_subscriptions
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists push_subscriptions_insert_self on public.push_subscriptions;
create policy push_subscriptions_insert_self
on public.push_subscriptions
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists push_subscriptions_update_self on public.push_subscriptions;
create policy push_subscriptions_update_self
on public.push_subscriptions
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists push_subscriptions_delete_self on public.push_subscriptions;
create policy push_subscriptions_delete_self
on public.push_subscriptions
for delete
to authenticated
using (user_id = auth.uid());
