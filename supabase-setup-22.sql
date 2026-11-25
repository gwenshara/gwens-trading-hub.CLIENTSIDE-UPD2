-- Run ONCE in Supabase: SQL Editor > + New query > paste ALL > Run. (After supabase-setup-21.sql.)
-- Adds "reset username" to moderation. A moderator ticks "Username": the account gets a temporary name
-- (user_xxxxxx) and the member must choose a new username before they can keep using the site.
-- Nickname resets stay as they were (only the nickname is cleared).

alter table public.profiles add column if not exists must_rename boolean not null default false;

-- changes a username everywhere: profile, login name, and old posts that stored the name as text
create or replace function public.rename_user(uid uuid, newname text) returns void
language plpgsql security definer set search_path = public as $$
declare old text; r record;
begin
  select username into old from public.profiles where id = uid;
  if old is null then raise exception 'Member not found.'; end if;
  update public.profiles set username = newname where id = uid;
  -- the login e-mail is built from the username (see auth.js)
  update auth.users set email = lower(newname) || '@gwenvaluehub.com',
    raw_user_meta_data = jsonb_set(coalesce(raw_user_meta_data,'{}'::jsonb), '{username}', to_jsonb(newname))
    where id = uid;
  update auth.identities set identity_data = jsonb_set(coalesce(identity_data,'{}'::jsonb), '{email}', to_jsonb(lower(newname) || '@gwenvaluehub.com'))
    where user_id = uid and provider = 'email';
  -- old ads, polls, comments, log entries... that stored the name as text
  for r in select c.table_name from information_schema.columns c
           join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name and t.table_type = 'BASE TABLE'
           where c.table_schema = 'public' and c.column_name = 'username' and c.table_name <> 'profiles' and c.data_type = 'text'
  loop
    execute format('update public.%I set username = $1 where lower(username) = lower($2)', r.table_name) using newname, old;
  end loop;
end $$;
revoke all on function public.rename_user(uuid, text) from public, anon, authenticated;

-- moderation reset, now with the username option (returns the new temporary username, or empty)
drop function if exists public.mod_reset(text, text[], boolean);
create or replace function public.mod_reset(target text, what text[], warn boolean default true) returns text
language plpgsql security definer set search_path = public as $$
declare
  t public.profiles%rowtype;
  me text; parts text[] := '{}'; w text; tmp text := '';
begin
  if not public.is_mod() then raise exception 'Only admins and moderators can do this.'; end if;
  select * into t from public.profiles where lower(username) = lower(target);
  if not found then raise exception 'Member not found.'; end if;
  if t.id = auth.uid() then raise exception 'You can''t moderate yourself.'; end if;
  if t.role = 'admin' then raise exception 'You can''t moderate an admin.'; end if;
  if 'moderator' = any(coalesce(t.roles,'{}')) and not public.is_admin() then
    raise exception 'Only an admin can moderate another moderator.'; end if;
  if exists(select 1 from unnest(coalesce(what,'{}')) x where x <> all(array['avatar','banner','nickname','bio','username'])) then
    raise exception 'Unknown option.'; end if;
  if coalesce(array_length(what,1),0) = 0 and not coalesce(warn,false) then
    raise exception 'Pick something to reset or send a warning.'; end if;
  select username into me from public.profiles where id = auth.uid();

  if 'avatar'   = any(coalesce(what,'{}')) then update public.profiles set avatar   = null where id = t.id; parts := array_append(parts, 'profile picture'::text); end if;
  if 'banner'   = any(coalesce(what,'{}')) then update public.profiles set banner   = null where id = t.id; parts := array_append(parts, 'banner'::text); end if;
  if 'nickname' = any(coalesce(what,'{}')) then update public.profiles set nickname = null where id = t.id; parts := array_append(parts, 'nickname'::text); end if;
  if 'bio'      = any(coalesce(what,'{}')) then update public.profiles set bio      = null where id = t.id; parts := array_append(parts, 'about me'::text); end if;
  if 'username' = any(coalesce(what,'{}')) then
    loop
      tmp := 'user_' || substr(md5(random()::text || clock_timestamp()::text), 1, 6);
      exit when not exists(select 1 from public.profiles where lower(username) = tmp);
    end loop;
    perform public.rename_user(t.id, tmp);
    update public.profiles set must_rename = true, nickname = null where id = t.id;
    parts := array_append(parts, 'username'::text);
  end if;

  if coalesce(warn,false) then
    w := 'Warning: don''t choose anything inappropriate.';
    if array_length(parts,1) > 0 then
      w := w || ' Your ' || array_to_string(parts, ', ') || ' ' || case when array_length(parts,1) > 1 then 'were' else 'was' end || ' reset by a moderator.';
    end if;
    if tmp <> '' then w := w || ' Your username is now ' || tmp || '. Please choose a new one.'; end if;
    insert into public.mod_warnings(user_id, text, by_name, what) values (t.id, w, me, what);
  end if;
  return tmp;
end $$;
revoke all on function public.mod_reset(text, text[], boolean) from public, anon;
grant execute on function public.mod_reset(text, text[], boolean) to authenticated;

-- the member picks a new username (only allowed after a moderator reset it)
create or replace function public.set_username(n text) returns void
language plpgsql security definer set search_path = public as $$
declare v text := btrim(coalesce(n,''));
begin
  if auth.uid() is null then raise exception 'Log in first.'; end if;
  if not exists(select 1 from public.profiles where id = auth.uid() and must_rename) then
    raise exception 'You can''t change your username.'; end if;
  if v !~ '^[A-Za-z0-9_]{3,20}$' then raise exception 'Username: 3-20 letters, numbers or _.'; end if;
  if v ~* '^user_[0-9a-f]{6}$' then raise exception 'Pick a real new username.'; end if;
  if exists(select 1 from public.profiles where lower(username) = lower(v) and id <> auth.uid()) then
    raise exception 'That username is taken.'; end if;
  perform public.rename_user(auth.uid(), v);
  update public.profiles set must_rename = false where id = auth.uid();
end $$;
revoke all on function public.set_username(text) from public, anon;
grant execute on function public.set_username(text) to authenticated;
