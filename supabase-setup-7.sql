-- Run ONCE in Supabase: SQL Editor > New query > paste > Run. (After the other setup files.)
-- 1) Poll images, 2) nickname, 3) Discord name + admin confirmation.

-- 1) Images on polls (up to 3 small pictures per poll)
alter table public.polls add column if not exists images jsonb not null default '[]'::jsonb;
alter table public.polls drop constraint if exists polls_images_check;
alter table public.polls add constraint polls_images_check
  check (jsonb_typeof(images)='array' and jsonb_array_length(images) <= 3 and octet_length(images::text) <= 600000);

-- 2) Nickname (the login name never changes)
alter table public.profiles add column if not exists nickname text;
alter table public.profiles drop constraint if exists profiles_nickname_check;
alter table public.profiles add constraint profiles_nickname_check
  check (nickname is null or char_length(nickname) between 1 and 24);

-- 3) Discord name + confirmation
alter table public.profiles add column if not exists discord text;
alter table public.profiles add column if not exists discord_verified boolean not null default false;
alter table public.profiles drop constraint if exists profiles_discord_check;
alter table public.profiles add constraint profiles_discord_check
  check (discord is null or discord ~ '^[A-Za-z0-9_.]{2,32}$');
-- a confirmed Discord name can belong to only one account
drop index if exists profiles_discord_verified_uq;
create unique index profiles_discord_verified_uq on public.profiles (lower(discord)) where discord_verified;

-- People may edit only these columns of their own row. Discord and its confirmation go through the functions below.
revoke update on public.profiles from authenticated;
grant update (avatar, banner, bio, nickname) on public.profiles to authenticated;

create or replace function public.set_discord(d text) returns void
language plpgsql security definer set search_path = public as $$
declare v text := nullif(btrim(coalesce(d,'')),'');
begin
  if auth.uid() is null then raise exception 'Log in first.'; end if;
  if v is not null then
    v := ltrim(v,'@');
    if v !~ '^[A-Za-z0-9_.]{2,32}$' then raise exception 'That Discord name looks wrong. Use letters, numbers, _ and . only.'; end if;
    if exists(select 1 from public.profiles where lower(discord)=lower(v) and discord_verified and id<>auth.uid()) then
      raise exception 'That Discord account is already confirmed by another member.'; end if;
  end if;
  update public.profiles set discord=v, discord_verified=false where id=auth.uid();
end $$;

create or replace function public.verify_discord(target text, ok boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Only admins can confirm a Discord account.'; end if;
  if ok and not exists(select 1 from public.profiles where lower(username)=lower(target) and discord is not null) then
    raise exception 'That member has not entered a Discord name.'; end if;
  begin
    update public.profiles set discord_verified=ok where lower(username)=lower(target);
  exception when unique_violation then
    raise exception 'Another member already has this Discord account confirmed.';
  end;
end $$;

revoke all on function public.set_discord(text) from public, anon;
revoke all on function public.verify_discord(text, boolean) from public, anon;
grant execute on function public.set_discord(text) to authenticated;
grant execute on function public.verify_discord(text, boolean) to authenticated;
