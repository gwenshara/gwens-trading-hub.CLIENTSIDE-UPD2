-- Run this ONCE in Supabase: SQL Editor > New query > paste > Run.

-- 1) Profiles: one row per account (username + role). Users can read but never change roles.
create table if not exists public.profiles(
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null check (username ~ '^[A-Za-z0-9_]{3,20}$'),
  role text not null default 'user' check (role in ('user','admin')),
  created_at timestamptz not null default now()
);
create unique index if not exists profiles_username_lower on public.profiles (lower(username));
alter table public.profiles enable row level security;
grant select on public.profiles to authenticated;
drop policy if exists "profiles readable by members" on public.profiles;
create policy "profiles readable by members" on public.profiles for select to authenticated using (true);

-- 2) Create the profile automatically when someone signs up.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, username)
  values (new.id, coalesce(new.raw_user_meta_data->>'username', split_part(new.email,'@',1)));
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- 3) Admin check used by the rules below.
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin')
$$;

-- 4) Trade ads. Only logged-in people can read, post and delete (own ads; admin can delete any).
create table if not exists public.ads(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  username text not null,
  offering jsonb not null check (jsonb_typeof(offering)='array' and jsonb_array_length(offering) between 1 and 30),
  looking  jsonb not null check (jsonb_typeof(looking)='array'  and jsonb_array_length(looking)  between 1 and 30),
  note text not null default '' check (char_length(note) <= 140),
  created_at timestamptz not null default now()
);
create index if not exists ads_created_idx on public.ads (created_at desc);
alter table public.ads enable row level security;
grant select, insert, delete on public.ads to authenticated;
drop policy if exists "ads read" on public.ads;
drop policy if exists "ads post" on public.ads;
drop policy if exists "ads delete" on public.ads;
create policy "ads read" on public.ads for select to authenticated using (true);
create policy "ads post" on public.ads for insert to authenticated
  with check (user_id = auth.uid() and username = (select username from public.profiles where id = auth.uid()));
create policy "ads delete" on public.ads for delete to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- 5) AFTER you have signed up as gwensharra on the live site, run this line to make it admin:
-- update public.profiles set role = 'admin' where lower(username) = 'gwensharra';
