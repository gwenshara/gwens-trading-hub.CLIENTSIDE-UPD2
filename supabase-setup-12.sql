-- Run ONCE in Supabase: SQL Editor > New query > paste > Run. (After the other setup files.)
-- Online status (Online / Idle / Do not disturb) and Discord-style roles.

alter table public.profiles add column if not exists status text not null default 'online';
alter table public.profiles drop constraint if exists profiles_status_check;
alter table public.profiles add constraint profiles_status_check check (status in ('online','idle','dnd'));
alter table public.profiles add column if not exists last_seen timestamptz;
alter table public.profiles add column if not exists roles text[] not null default '{}';

-- A member can only change their own status and last_seen through this function
create or replace function public.set_presence(s text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  if s is not null and s not in ('online','idle','dnd') then raise exception 'Unknown status.'; end if;
  update public.profiles set last_seen = now(), status = coalesce(s, status) where id = auth.uid();
end $$;

-- Only admins can give or remove roles
create or replace function public.set_roles(target text, r text[]) returns void
language plpgsql security definer set search_path = public as $$
declare ok text[] := array['official_middleman','moderator','donator','top_trader'];
begin
  if not public.is_admin() then raise exception 'Only admins can change roles.'; end if;
  if exists(select 1 from unnest(coalesce(r,'{}')) x where x <> all(ok)) then raise exception 'Unknown role.'; end if;
  update public.profiles set roles = coalesce(r,'{}') where lower(username) = lower(target);
end $$;

revoke all on function public.set_presence(text) from public, anon;
revoke all on function public.set_roles(text, text[]) from public, anon;
grant execute on function public.set_presence(text) to authenticated;
grant execute on function public.set_roles(text, text[]) to authenticated;
