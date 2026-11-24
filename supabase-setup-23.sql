-- Run ONCE in Supabase: SQL Editor > + New query > paste ALL > Run. (After supabase-setup-22.sql.)
-- Roblox link: a member gets a one-time code on their profile, types it into your Roblox game, and the game
-- tells the website which Roblox account typed it. No Roblox password or login is ever involved.

alter table public.profiles add column if not exists roblox_id bigint;
alter table public.profiles add column if not exists roblox_name text;
drop index if exists profiles_roblox_id_uq;
create unique index profiles_roblox_id_uq on public.profiles (roblox_id) where roblox_id is not null;

-- one-time codes (nobody can read this table from the website)
create table if not exists public.roblox_codes(
  user_id uuid primary key references auth.users(id) on delete cascade,
  code text not null unique,
  expires_at timestamptz not null
);
alter table public.roblox_codes enable row level security;
revoke all on public.roblox_codes from anon, authenticated;

-- the secret shared with your Roblox game (nobody can read this table from the website either)
create table if not exists public.roblox_config(key text primary key, value text not null);
alter table public.roblox_config enable row level security;
revoke all on public.roblox_config from anon, authenticated;
insert into public.roblox_config(key, value)
  values ('secret', md5(random()::text || clock_timestamp()::text) || md5(random()::text || clock_timestamp()::text))
  on conflict (key) do nothing;

-- 1) the member asks for a code (valid 10 minutes)
create or replace function public.roblox_start() returns jsonb
language plpgsql security definer set search_path = public as $$
declare c text := ''; chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; i int;
begin
  if auth.uid() is null then raise exception 'Log in first.'; end if;
  for i in 1..8 loop c := c || substr(chars, 1 + floor(random() * 32)::int, 1); end loop;
  insert into public.roblox_codes(user_id, code, expires_at) values (auth.uid(), c, now() + interval '10 minutes')
    on conflict (user_id) do update set code = excluded.code, expires_at = excluded.expires_at;
  return jsonb_build_object('code', c, 'minutes', 10);
end $$;

-- 2) the Roblox game server reports who typed which code. Only your game knows the secret.
create or replace function public.roblox_link(p_secret text, p_code text, p_id bigint, p_name text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare s text; r record; uname text;
begin
  select value into s from public.roblox_config where key = 'secret';
  if s is null or p_secret is distinct from s then return jsonb_build_object('status', 'denied'); end if;
  if p_id is null or p_id <= 0 or p_name is null or p_name !~ '^[A-Za-z0-9_]{3,20}$' then
    return jsonb_build_object('status', 'bad'); end if;
  select * into r from public.roblox_codes where code = upper(btrim(coalesce(p_code, ''))) and expires_at > now();
  if not found then return jsonb_build_object('status', 'invalid'); end if;
  if exists (select 1 from public.profiles where roblox_id = p_id and id <> r.user_id) then
    return jsonb_build_object('status', 'taken'); end if;
  update public.profiles set roblox_id = p_id, roblox_name = p_name where id = r.user_id returning username into uname;
  delete from public.roblox_codes where user_id = r.user_id;
  return jsonb_build_object('status', 'ok', 'username', uname);
end $$;

-- 3) unlink: yourself, or (admins only) anybody
create or replace function public.roblox_unlink(target text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Log in first.'; end if;
  if target is null or lower(target) = (select lower(username) from public.profiles where id = auth.uid()) then
    update public.profiles set roblox_id = null, roblox_name = null where id = auth.uid();
  else
    if not public.is_admin() then raise exception 'Only admins can unlink someone else.'; end if;
    update public.profiles set roblox_id = null, roblox_name = null where lower(username) = lower(target);
  end if;
end $$;

revoke all on function public.roblox_start() from public, anon;
revoke all on function public.roblox_link(text, text, bigint, text) from public;
revoke all on function public.roblox_unlink(text) from public, anon;
grant execute on function public.roblox_start() to authenticated;
grant execute on function public.roblox_link(text, text, bigint, text) to anon, authenticated;
grant execute on function public.roblox_unlink(text) to authenticated;

-- the secret to paste into the Roblox script (it shows in the result table below)
select value as "COPY THIS SECRET INTO THE ROBLOX SCRIPT" from public.roblox_config where key = 'secret';
