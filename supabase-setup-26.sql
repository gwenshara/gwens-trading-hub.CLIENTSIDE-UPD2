-- Run ONCE in Supabase: SQL Editor > + New query > paste ALL > Run. (After supabase-setup-22.sql.) Safe to run again.
-- Adds: a moderator can write their own message that the warned member sees.

drop function if exists public.mod_reset(text, text[], boolean);
drop function if exists public.mod_reset(text, text[], boolean, text);
create or replace function public.mod_reset(target text, what text[], warn boolean default true, p_message text default '') returns text
language plpgsql security definer set search_path = public as $$
declare
  t public.profiles%rowtype;
  me text; parts text[] := '{}'; w text; tmp text := ''; msg text := btrim(coalesce(p_message,''));
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
  if char_length(msg) > 500 then raise exception 'Message too long (500 characters max).'; end if;
  if coalesce(array_length(what,1),0) = 0 and not coalesce(warn,false) and msg = '' then
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

  if coalesce(warn,false) or msg <> '' then
    w := case when msg <> '' then msg else 'Warning: don''t choose anything inappropriate.' end;
    if array_length(parts,1) > 0 then
      w := w || ' Your ' || array_to_string(parts, ', ') || ' ' || case when array_length(parts,1) > 1 then 'were' else 'was' end || ' reset by a moderator.';
    end if;
    if tmp <> '' then w := w || ' Your username is now ' || tmp || '. Please choose a new one.'; end if;
    insert into public.mod_warnings(user_id, text, by_name, what) values (t.id, w, me, what);
  end if;
  return tmp;
end $$;
revoke all on function public.mod_reset(text, text[], boolean, text) from public, anon;
grant execute on function public.mod_reset(text, text[], boolean, text) to authenticated;

notify pgrst, 'reload schema';
