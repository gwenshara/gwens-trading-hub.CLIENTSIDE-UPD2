-- Run ONCE in Supabase: SQL Editor > + New query > paste ALL > Run. (After supabase-setup-24.sql.)
-- Adds: 1) IP address of a member, visible ONLY to admins and moderators
--       2) max 3 accounts per IP address. The 4th sign-up is refused ("You're not able to make more accounts.")
--          and any account that still gets created beyond 3 on one IP is banned automatically.
-- Safe to run again.

-- ---------- where each account was created from (nobody can read this from the website directly) ----------
create table if not exists public.signup_ips(
  user_id uuid primary key references auth.users(id) on delete cascade,
  ip text not null,
  created_at timestamptz not null default now()
);
create index if not exists signup_ips_ip_idx on public.signup_ips(ip);
alter table public.signup_ips enable row level security;
revoke all on public.signup_ips from anon, authenticated;

-- existing accounts count towards the limit with the last IP we saw for them (nobody gets banned by this)
insert into public.signup_ips(user_id, ip, created_at)
select u.user_id, public.norm_ip(u.ip), coalesce(p.created_at, now())
from public.user_ips u join public.profiles p on p.id = u.user_id
where public.norm_ip(u.ip) is not null
on conflict (user_id) do nothing;

-- ---------- 1) called BEFORE sign-up (also by logged-out visitors): may this IP still make an account? ----------
create or replace function public.can_signup() returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_ip text := public.norm_ip(public.req_ip());
begin
  if v_ip is null then return jsonb_build_object('ok', true); end if;
  if exists(select 1 from public.ip_bans where ip = v_ip) then return jsonb_build_object('ok', false); end if;
  if (select count(*) from public.signup_ips where ip = v_ip) >= 3 then return jsonb_build_object('ok', false); end if;
  return jsonb_build_object('ok', true);
end $$;

-- ---------- 2) called right AFTER sign-up: remembers the IP and bans the account if it is more than the 3rd ----------
create or replace function public.claim_signup_ip() returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_raw text := public.req_ip(); v_ip text := public.norm_ip(public.req_ip()); v_mine timestamptz; n int; v_name text;
begin
  if auth.uid() is null or v_ip is null then return jsonb_build_object('ok', true); end if;
  insert into public.signup_ips(user_id, ip) values (auth.uid(), v_ip) on conflict (user_id) do nothing;
  insert into public.user_ips(user_id, ip) values (auth.uid(), v_raw)
    on conflict (user_id) do update set ip = excluded.ip, seen_at = now();
  if public.is_admin() then return jsonb_build_object('ok', true); end if;
  select created_at into v_mine from public.signup_ips where user_id = auth.uid();
  select count(*) into n from public.signup_ips s
    where s.ip = v_ip and (s.created_at < v_mine or (s.created_at = v_mine and s.user_id <= auth.uid()));
  if n > 3 then
    select username into v_name from public.profiles where id = auth.uid();
    insert into public.user_bans(user_id, username, reason, banned_by)
      values (auth.uid(), coalesce(v_name, ''), 'More than 3 accounts on one IP address.', 'system')
      on conflict (user_id) do nothing;
    delete from public.push_subs where user_id = auth.uid();
    return jsonb_build_object('ok', false, 'banned', true);
  end if;
  return jsonb_build_object('ok', true);
end $$;

-- ---------- 3) the IP of a member: admins and moderators only ----------
create or replace function public.get_member_ip(target text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare t public.profiles%rowtype; v_last text; v_seen timestamptz; v_signup text; same jsonb;
begin
  if not public.is_mod() then raise exception 'Only admins and moderators can do this.'; end if;
  select * into t from public.profiles where lower(username) = lower(target);
  if not found then raise exception 'Member not found.'; end if;
  if (t.role = 'admin' or 'moderator' = any(coalesce(t.roles, '{}'))) and t.id <> auth.uid() and not public.is_admin() then
    raise exception 'Only an admin can see the IP of an admin or a moderator.'; end if;
  select ip, seen_at into v_last, v_seen from public.user_ips where user_id = t.id;
  select ip into v_signup from public.signup_ips where user_id = t.id;
  select coalesce(jsonb_agg(p.username order by p.username), '[]'::jsonb) into same
  from public.profiles p
  where p.id <> t.id and (
    exists(select 1 from public.user_ips x where x.user_id = p.id and public.norm_ip(x.ip) = public.norm_ip(v_last))
    or exists(select 1 from public.signup_ips y where y.user_id = p.id and y.ip = v_signup));
  return jsonb_build_object('ip', v_last, 'seen_at', v_seen, 'signup_ip', v_signup, 'same_ip_accounts', same,
    'ip_banned', exists(select 1 from public.ip_bans where ip = public.norm_ip(v_last)));
end $$;

-- the banned list now shows the full IP to staff (it was masked before). Only admins and moderators can call it.
create or replace function public.list_bans() returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_mod() then raise exception 'Only admins and moderators can do this.'; end if;
  return coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (
    select 'user'::text as kind, user_id::text as key, username, ''::text as ip, reason, banned_by, created_at from public.user_bans
    union all
    select 'ip', id::text, username, ip, reason, banned_by, created_at from public.ip_bans
  ) x), '[]'::jsonb);
end $$;

-- ---------- permissions ----------
revoke all on function public.can_signup() from public;
revoke all on function public.claim_signup_ip() from public, anon;
revoke all on function public.get_member_ip(text) from public, anon;
grant execute on function public.can_signup() to anon, authenticated;
grant execute on function public.claim_signup_ip() to authenticated;
grant execute on function public.get_member_ip(text) to authenticated;

select 'IP view and the 3-accounts-per-IP limit are ready.' as result;
