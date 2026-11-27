-- Run ONCE in Supabase: SQL Editor > + New query > paste ALL > Run. Safe to run again.
-- Needs supabase-setup-5.sql (value voting), supabase-setup-18.sql (notifications),
-- supabase-setup-21.sql (moderators) and supabase-setup-35.sql (banned accounts).
-- Adds two things:
--   1) "See who voted" on every value-voting poll (everyone can see it, even logged out)
--   2) For moderators and admins: a list of who has notifications switched on (Settings > Notifications)

-- 1) who voted on one poll: name, agree/disagree, when. Banned accounts are hidden (admins still see them).
create or replace function public.poll_voters(p_poll uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('u', p.username, 'v', pv.vote, 't', pv.created_at) order by pv.created_at), '[]'::jsonb)
  from public.poll_votes pv
  join public.profiles p on p.id = pv.user_id
  where pv.poll_id = p_poll
    and (not public.is_banned_id(pv.user_id) or public.is_admin())
$$;
revoke all on function public.poll_voters(uuid) from public;
grant execute on function public.poll_voters(uuid) to anon, authenticated;

-- 2) who has notifications on: one row per person (a person can have several devices).
--    "prefs" says which kinds that person still has switched on (on = true on at least one device).
--    Only admins and moderators can call it.
create or replace function public.push_who() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r jsonb; total int;
begin
  if not public.is_mod() then raise exception 'Only admins and moderators can do this.'; end if;
  select count(*) into total from public.profiles p
    where not public.is_banned_id(p.id) or public.is_admin();
  select coalesce(jsonb_agg(x order by lower(x->>'u')), '[]'::jsonb) into r from (
    select jsonb_build_object(
      'u', p.username,
      'devices', count(*),
      'since', min(ps.created_at),
      'status', p.status,
      'prefs', jsonb_build_object(
        'dm',      bool_or(coalesce(ps.prefs->>'dm', 'true')      <> 'false'),
        'group',   bool_or(coalesce(ps.prefs->>'group', 'true')   <> 'false'),
        'mm',      bool_or(coalesce(ps.prefs->>'mm', 'true')      <> 'false'),
        'vote',    bool_or(coalesce(ps.prefs->>'vote', 'true')    <> 'false'),
        'upd',     bool_or(coalesce(ps.prefs->>'upd', 'true')     <> 'false'),
        'newitem', bool_or(coalesce(ps.prefs->>'newitem', 'true') <> 'false'))) as x
    from public.push_subs ps
    join public.profiles p on p.id = ps.user_id
    where not public.is_banned_id(p.id) or public.is_admin()
    group by p.id, p.username, p.status
  ) t;
  return jsonb_build_object('total', total, 'users', r);
end $$;
revoke all on function public.push_who() from public, anon;
grant execute on function public.push_who() to authenticated;

notify pgrst, 'reload schema';
select 'Done: poll_voters and push_who are ready.' as result;
