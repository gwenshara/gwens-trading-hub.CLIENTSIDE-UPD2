-- Run ONCE in Supabase: SQL Editor > + New query > paste ALL > Run. (After supabase-setup-23.sql.)
-- Adds: 1) bans (a member's account + their IP address), usable by admins and moderators
--       2) permanent account deletion (the member themselves, or an admin)
-- Safe to run again.

-- ---------- tables (nobody can read them from the website directly) ----------
create table if not exists public.user_ips(
  user_id uuid primary key references auth.users(id) on delete cascade,
  ip text not null,
  seen_at timestamptz not null default now()
);
create table if not exists public.user_bans(
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  reason text not null default '',
  banned_by text not null,
  created_at timestamptz not null default now()
);
create table if not exists public.ip_bans(
  id bigint generated always as identity primary key,
  ip text not null unique,
  username text not null default '',
  reason text not null default '',
  banned_by text not null,
  created_at timestamptz not null default now()
);
alter table public.user_ips enable row level security;
alter table public.user_bans enable row level security;
alter table public.ip_bans enable row level security;
revoke all on public.user_ips, public.user_bans, public.ip_bans from anon, authenticated;

-- ---------- helpers ----------
-- the visitor's real IP address, as the Supabase gateway sees it (the browser can't fake this)
create or replace function public.req_ip() returns text
language sql stable as $$
  select nullif(btrim(coalesce(
    nullif(current_setting('request.headers', true), '')::json ->> 'cf-connecting-ip',
    split_part(coalesce(nullif(current_setting('request.headers', true), '')::json ->> 'x-forwarded-for', ''), ',', 1)
  )), '')
$$;

-- IPv4 stays as it is; IPv6 is cut to its /64 block (people on one connection get a whole block)
create or replace function public.norm_ip(i text) returns text
language plpgsql immutable as $$
begin
  if i is null then return null; end if;
  if position(':' in i) > 0 then return host(network(set_masklen(i::inet, 64))); end if;
  return host(i::inet);
exception when others then return null;
end $$;

create or replace function public.mask_ip(i text) returns text
language sql immutable as $$
  select case when position(':' in i) > 0 then split_part(i, ':', 1) || ':' || split_part(i, ':', 2) || ':*'
              else split_part(i, '.', 1) || '.' || split_part(i, '.', 2) || '.*.*' end
$$;

-- is the person making this request banned? (admins are never banned, so you can't lock yourself out)
create or replace function public.is_banned() returns boolean
language sql stable security definer set search_path = public as $$
  select not coalesce(public.is_admin(), false) and (
    exists(select 1 from public.user_bans where user_id = auth.uid())
    or exists(select 1 from public.ip_bans where ip = public.norm_ip(public.req_ip()))
  )
$$;

-- ---------- called by every page ----------
-- logged in: remembers the IP and says whether the account / IP is banned. Logged out: checks the IP only.
create or replace function public.session_check() returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_ip text := public.req_ip(); b record;
begin
  if auth.uid() is not null and v_ip is not null then
    insert into public.user_ips(user_id, ip) values (auth.uid(), v_ip)
      on conflict (user_id) do update set ip = excluded.ip, seen_at = now();
  end if;
  if public.is_admin() then return jsonb_build_object('banned', false); end if;
  select * into b from public.user_bans where user_id = auth.uid();
  if found then return jsonb_build_object('banned', true, 'kind', 'account', 'reason', b.reason); end if;
  if exists(select 1 from public.ip_bans where ip = public.norm_ip(v_ip)) then
    return jsonb_build_object('banned', true, 'kind', 'ip', 'reason', ''); end if;
  return jsonb_build_object('banned', false);
end $$;

-- ---------- staff tools ----------
create or replace function public.ban_user(target text, reason text default '', ban_ip boolean default true) returns jsonb
language plpgsql security definer set search_path = public as $$
declare t public.profiles%rowtype; me text; v_ip text; mine text; ipdone boolean := false; why text := left(coalesce(reason, ''), 200);
begin
  if not public.is_mod() then raise exception 'Only admins and moderators can do this.'; end if;
  select * into t from public.profiles where lower(username) = lower(target);
  if not found then raise exception 'Member not found.'; end if;
  if t.id = auth.uid() then raise exception 'You can''t ban yourself.'; end if;
  if t.role = 'admin' then raise exception 'You can''t ban an admin.'; end if;
  if 'moderator' = any(coalesce(t.roles, '{}')) and not public.is_admin() then
    raise exception 'Only an admin can ban a moderator.'; end if;
  select username into me from public.profiles where id = auth.uid();
  insert into public.user_bans(user_id, username, reason, banned_by) values (t.id, t.username, why, me)
    on conflict (user_id) do update set reason = excluded.reason, banned_by = excluded.banned_by, created_at = now();
  if ban_ip then
    select public.norm_ip(u.ip) into v_ip from public.user_ips u where u.user_id = t.id;
    mine := public.norm_ip(public.req_ip());
    if v_ip is not null and v_ip is distinct from mine then
      insert into public.ip_bans(ip, username, reason, banned_by) values (v_ip, t.username, why, me)
        on conflict (ip) do nothing;
      ipdone := true;
    end if;
  end if;
  delete from public.push_subs where user_id = t.id;
  return jsonb_build_object('ok', true, 'ip_banned', ipdone);
end $$;

create or replace function public.unban_member(target text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_mod() then raise exception 'Only admins and moderators can do this.'; end if;
  delete from public.user_bans where lower(username) = lower(target);
  delete from public.ip_bans where lower(username) = lower(target);
end $$;

create or replace function public.list_bans() returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_mod() then raise exception 'Only admins and moderators can do this.'; end if;
  return coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (
    select 'user'::text as kind, user_id::text as key, username, ''::text as ip, reason, banned_by, created_at from public.user_bans
    union all
    select 'ip', id::text, username, public.mask_ip(ip), reason, banned_by, created_at from public.ip_bans
  ) x), '[]'::jsonb);
end $$;

create or replace function public.unban_entry(p_kind text, p_key text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_mod() then raise exception 'Only admins and moderators can do this.'; end if;
  if p_kind = 'user' then delete from public.user_bans where user_id = p_key::uuid;
  elsif p_kind = 'ip' then delete from public.ip_bans where id = p_key::bigint;
  end if;
end $$;

-- ---------- permanent account deletion ----------
-- removes the account and, through the database links, everything of theirs: profile, ads, polls, votes,
-- comments, friends, chats they were in (private messages disappear for the other person too), hearts, etc.
create or replace function public.purge_user(uid uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from public.group_msgs where sender_id = uid;
  delete from auth.users where id = uid;
end $$;
revoke all on function public.purge_user(uuid) from public, anon, authenticated;

create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public as $$
declare r text;
begin
  if auth.uid() is null then raise exception 'Log in first.'; end if;
  select role into r from public.profiles where id = auth.uid();
  if r = 'admin' then raise exception 'Admin accounts can''t be deleted here.'; end if;
  if public.is_banned() then raise exception 'A banned account can''t be deleted.'; end if;
  perform public.purge_user(auth.uid());
end $$;

create or replace function public.admin_delete_user(target text) returns void
language plpgsql security definer set search_path = public as $$
declare t public.profiles%rowtype;
begin
  if not public.is_admin() then raise exception 'Only an admin can do this.'; end if;
  select * into t from public.profiles where lower(username) = lower(target);
  if not found then raise exception 'Member not found.'; end if;
  if t.id = auth.uid() then raise exception 'You can''t delete yourself here.'; end if;
  if t.role = 'admin' then raise exception 'You can''t delete an admin.'; end if;
  perform public.purge_user(t.id);
end $$;

-- ---------- permissions ----------
revoke all on function public.session_check() from public;
revoke all on function public.ban_user(text, text, boolean) from public, anon;
revoke all on function public.unban_member(text) from public, anon;
revoke all on function public.list_bans() from public, anon;
revoke all on function public.unban_entry(text, text) from public, anon;
revoke all on function public.delete_my_account() from public, anon;
revoke all on function public.admin_delete_user(text) from public, anon;
grant execute on function public.session_check() to anon, authenticated;
grant execute on function public.is_banned() to anon, authenticated;
grant execute on function public.req_ip(), public.norm_ip(text) to anon, authenticated;
grant execute on function public.ban_user(text, text, boolean) to authenticated;
grant execute on function public.unban_member(text) to authenticated;
grant execute on function public.list_bans() to authenticated;
grant execute on function public.unban_entry(text, text) to authenticated;
grant execute on function public.delete_my_account() to authenticated;
grant execute on function public.admin_delete_user(text) to authenticated;

-- ---------- a banned member can't write anything anywhere (posting, chatting, editing, voting rows...) ----------
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public'
           and tablename not in ('user_ips','user_bans','ip_bans','push_config','roblox_config','roblox_codes')
  loop
    execute format('drop policy if exists "ban block insert" on public.%I', t);
    execute format('drop policy if exists "ban block update" on public.%I', t);
    execute format('drop policy if exists "ban block delete" on public.%I', t);
    execute format('create policy "ban block insert" on public.%I as restrictive for insert to authenticated with check (not public.is_banned())', t);
    execute format('create policy "ban block update" on public.%I as restrictive for update to authenticated using (not public.is_banned())', t);
    execute format('create policy "ban block delete" on public.%I as restrictive for delete to authenticated using (not public.is_banned())', t);
  end loop;
end $$;

select 'Bans and account deletion are ready.' as result;
