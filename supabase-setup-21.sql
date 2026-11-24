-- Run ONCE in Supabase: SQL Editor > + New query > paste ALL > Run. (After supabase-setup-20.sql.)
-- Adds moderation: admins AND moderators can reset someone's profile picture, banner, nickname or
-- "About me" and send them a warning. The member sees the warning as a popup the next time a page opens.

-- 1) "is this person a moderator or an admin?"
create or replace function public.is_mod() returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles
    where id = auth.uid() and (role = 'admin' or 'moderator' = any(roles)))
$$;

-- 2) warnings. A member reads only their own; admins and moderators can read all (a history of who got warned).
create table if not exists public.mod_warnings(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  text text not null,
  by_name text,
  what text[],
  created_at timestamptz not null default now(),
  seen_at timestamptz
);
create index if not exists mod_warnings_user_idx on public.mod_warnings (user_id, created_at desc);
alter table public.mod_warnings enable row level security;
revoke all on public.mod_warnings from anon, authenticated;
grant select on public.mod_warnings to authenticated;
drop policy if exists "warn read" on public.mod_warnings;
create policy "warn read" on public.mod_warnings for select to authenticated
  using (user_id = auth.uid() or public.is_mod());

-- 3) reset parts of a profile + send the warning
create or replace function public.mod_reset(target text, what text[], warn boolean default true) returns void
language plpgsql security definer set search_path = public as $$
declare
  t public.profiles%rowtype;
  me text;
  parts text[] := '{}';
  w text;
begin
  if not public.is_mod() then raise exception 'Only admins and moderators can do this.'; end if;
  select * into t from public.profiles where lower(username) = lower(target);
  if not found then raise exception 'Member not found.'; end if;
  if t.id = auth.uid() then raise exception 'You can''t moderate yourself.'; end if;
  if t.role = 'admin' then raise exception 'You can''t moderate an admin.'; end if;
  if 'moderator' = any(coalesce(t.roles,'{}')) and not public.is_admin() then
    raise exception 'Only an admin can moderate another moderator.'; end if;
  if exists(select 1 from unnest(coalesce(what,'{}')) x where x <> all(array['avatar','banner','nickname','bio'])) then
    raise exception 'Unknown option.'; end if;
  if coalesce(array_length(what,1),0) = 0 and not coalesce(warn,false) then
    raise exception 'Pick something to reset or send a warning.'; end if;
  select username into me from public.profiles where id = auth.uid();

  if 'avatar'   = any(coalesce(what,'{}')) then update public.profiles set avatar   = null where id = t.id; parts := parts || 'profile picture'; end if;
  if 'banner'   = any(coalesce(what,'{}')) then update public.profiles set banner   = null where id = t.id; parts := parts || 'banner'; end if;
  if 'nickname' = any(coalesce(what,'{}')) then update public.profiles set nickname = null where id = t.id; parts := parts || 'nickname'; end if;
  if 'bio'      = any(coalesce(what,'{}')) then update public.profiles set bio      = null where id = t.id; parts := parts || 'about me'; end if;

  if coalesce(warn,false) then
    w := 'Warning: don''t choose anything inappropriate.';
    if array_length(parts,1) > 0 then
      w := w || ' Your ' || array_to_string(parts, ', ') || ' ' || case when array_length(parts,1) > 1 then 'were' else 'was' end || ' reset by a moderator.';
    end if;
    insert into public.mod_warnings(user_id, text, by_name, what) values (t.id, w, me, what);
  end if;
end $$;
revoke all on function public.mod_reset(text, text[], boolean) from public, anon;
grant execute on function public.mod_reset(text, text[], boolean) to authenticated;

-- 4) the member presses "I understand"
create or replace function public.ack_warnings() returns void
language sql security definer set search_path = public as $$
  update public.mod_warnings set seen_at = now() where user_id = auth.uid() and seen_at is null
$$;
revoke all on function public.ack_warnings() from public, anon;
grant execute on function public.ack_warnings() to authenticated;
