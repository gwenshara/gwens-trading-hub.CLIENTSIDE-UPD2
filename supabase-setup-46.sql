-- Run ONCE in Supabase: SQL Editor > + New query > paste ALL > Run. (After supabase-setup-33.sql.)
-- Adds: linked accounts can no longer vote twice (or three times) on the same Value voting poll.
-- Two accounts are "linked" when the site has seen them on the same connection. The check happens on the server,
-- so it cannot be skipped. Admins are not blocked. Votes that were already cast are left as they are.
-- Safe to run again.

-- every account linked to the given account
create or replace function public.linked_account_ids(p_uid uuid) returns setof uuid
language plpgsql stable security definer set search_path = public as $$
declare v_now text := public.norm_ip(public.req_ip());
begin
  return query
  with mine as (
    select public.norm_ip(ip) as ip from public.user_ips where user_id = p_uid
    union select ip from public.signup_ips where user_id = p_uid
    union select v_now where v_now is not null and p_uid = auth.uid()
  )
  select u.user_id from public.user_ips u where u.user_id <> p_uid and public.norm_ip(u.ip) in (select ip from mine where ip is not null)
  union
  select s.user_id from public.signup_ips s where s.user_id <> p_uid and s.ip in (select ip from mine where ip is not null);
end $$;
revoke all on function public.linked_account_ids(uuid) from public, anon, authenticated;

-- refuse a vote when a linked account already voted on the same poll
create or replace function public.guard_poll_vote() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(public.is_admin(), false) then return new; end if;
  if exists(
    select 1 from public.poll_votes pv
    where pv.poll_id = new.poll_id and pv.user_id <> new.user_id
      and pv.user_id in (select public.linked_account_ids(new.user_id))
  ) then
    raise exception 'A linked account has already voted on this poll.';
  end if;
  return new;
end $$;

drop trigger if exists poll_vote_guard on public.poll_votes;
create trigger poll_vote_guard before insert or update on public.poll_votes
  for each row execute function public.guard_poll_vote();
