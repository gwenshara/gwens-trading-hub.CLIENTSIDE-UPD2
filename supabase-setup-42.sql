-- Run ONCE in Supabase: SQL Editor > + New query > paste ALL > Run. Safe to run again.
-- Needs supabase-setup-18.sql (push notifications) and supabase-setup-41.sql (wiki updates).
-- Adds two notifications people can switch off in Settings > Notifications:
--   "Wiki updates"  : when the admin posts an update
--   "New items"     : when an item is added to the New category

alter table public.push_subs alter column prefs
  set default '{"dm":true,"group":true,"mm":true,"vote":true,"upd":true,"newitem":true}'::jsonb;

-- the settings functions now know the two new switches (missing = on)
create or replace function public.push_subscribe(p_endpoint text, p_p256dh text, p_auth text, p_prefs jsonb default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); np jsonb; r jsonb;
begin
  if me is null then raise exception 'Log in first.'; end if;
  if p_endpoint is null or char_length(p_endpoint) > 1000 or p_endpoint !~ '^https://' then raise exception 'Bad push address.'; end if;
  if p_prefs is not null then
    np := jsonb_build_object(
      'dm',      coalesce(p_prefs->>'dm', 'true')      <> 'false',
      'group',   coalesce(p_prefs->>'group', 'true')   <> 'false',
      'mm',      coalesce(p_prefs->>'mm', 'true')      <> 'false',
      'vote',    coalesce(p_prefs->>'vote', 'true')    <> 'false',
      'upd',     coalesce(p_prefs->>'upd', 'true')     <> 'false',
      'newitem', coalesce(p_prefs->>'newitem', 'true') <> 'false');
  end if;
  insert into public.push_subs(user_id, endpoint, p256dh, auth, prefs)
  values (me, p_endpoint, p_p256dh, p_auth, coalesce(np, '{"dm":true,"group":true,"mm":true,"vote":true,"upd":true,"newitem":true}'::jsonb))
  on conflict (endpoint) do update set
    p256dh = excluded.p256dh,
    auth = excluded.auth,
    prefs = case when np is not null then np
                 when public.push_subs.user_id = me then public.push_subs.prefs
                 else excluded.prefs end,
    user_id = me
  returning prefs into r;
  return r;
end $$;
revoke all on function public.push_subscribe(text, text, text, jsonb) from public, anon;
grant execute on function public.push_subscribe(text, text, text, jsonb) to authenticated;

create or replace function public.push_set_prefs(p_endpoint text, p_prefs jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare np jsonb; r jsonb;
begin
  np := jsonb_build_object(
    'dm',      coalesce(p_prefs->>'dm', 'true')      <> 'false',
    'group',   coalesce(p_prefs->>'group', 'true')   <> 'false',
    'mm',      coalesce(p_prefs->>'mm', 'true')      <> 'false',
    'vote',    coalesce(p_prefs->>'vote', 'true')    <> 'false',
    'upd',     coalesce(p_prefs->>'upd', 'true')     <> 'false',
    'newitem', coalesce(p_prefs->>'newitem', 'true') <> 'false');
  update public.push_subs set prefs = np where endpoint = p_endpoint and user_id = auth.uid() returning prefs into r;
  return r;
end $$;
revoke all on function public.push_set_prefs(text, jsonb) from public, anon;
grant execute on function public.push_set_prefs(text, jsonb) to authenticated;

-- a wiki update was posted: everyone with notifications on (except the poster)
create or replace function public.tg_push_wiki() returns trigger
language plpgsql security definer set search_path = public as $$
declare ids uuid[];
begin
  select array_agg(distinct ps.user_id) into ids
    from public.push_subs ps join public.profiles p on p.id = ps.user_id
    where p.username is distinct from new.username;
  if ids is null then return new; end if;
  perform public.push_send(ids, 'upd', 'Wiki update', left(new.body, 150), 'index.html', 'upd-' || new.id::text);
  return new;
exception when others then
  return new;
end $$;
drop trigger if exists push_wiki on public.wiki_updates;
create trigger push_wiki after insert on public.wiki_updates for each row execute function public.tg_push_wiki();

-- an item was newly marked "New": compare the saved edits before and after
create or replace function public.tg_push_newitems() returns trigger
language plpgsql security definer set search_path = public as $$
declare ov jsonb; nv jsonb; names text[]; n int; msg text; ids uuid[];
begin
  if new.key <> 'overrides' then return new; end if;
  begin nv := new.value::jsonb; ov := old.value::jsonb; exception when others then return new; end;
  if jsonb_typeof(nv) <> 'object' or jsonb_typeof(ov) <> 'object' then return new; end if;
  select array_agg(t.k order by t.k) into names
    from jsonb_object_keys(nv) as t(k)
    where (nv -> t.k ->> 'nw') = 'true' and coalesce(ov -> t.k ->> 'nw', '') <> 'true';
  n := coalesce(array_length(names, 1), 0);
  if n = 0 then return new; end if;
  msg := case when n = 1 then names[1] || ' was added to the New items'
              when n <= 3 then array_to_string(names, ', ') || ' were added to the New items'
              else n::text || ' items were added to the New items' end;
  select array_agg(distinct ps.user_id) into ids
    from public.push_subs ps join public.profiles p on p.id = ps.user_id
    where p.username is distinct from new.updated_by;
  if ids is null then return new; end if;
  perform public.push_send(ids, 'newitem', 'New items', msg, 'index.html', 'newitem');
  return new;
exception when others then
  return new;
end $$;
drop trigger if exists push_newitems on public.site_state;
create trigger push_newitems after update on public.site_state
  for each row when (new.key = 'overrides') execute function public.tg_push_newitems();

notify pgrst, 'reload schema';
