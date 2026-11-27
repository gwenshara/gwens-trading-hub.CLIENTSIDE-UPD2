-- Run ONCE in Supabase: SQL Editor > + New query > paste ALL > Run. Safe to run again.
-- Needs supabase-setup-43.sql. "See who voted" now also shows each voter's profile picture.
-- (A picture bigger than ~100 KB is skipped and the default one is shown, to keep the list fast.)
create or replace function public.poll_voters(p_poll uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('u', p.username, 'v', pv.vote, 't', pv.created_at,
           'a', case when p.avatar is not null and char_length(p.avatar) <= 100000 then p.avatar end)
           order by pv.created_at), '[]'::jsonb)
  from public.poll_votes pv
  join public.profiles p on p.id = pv.user_id
  where pv.poll_id = p_poll
    and (not public.is_banned_id(pv.user_id) or public.is_admin())
$$;
revoke all on function public.poll_voters(uuid) from public;
grant execute on function public.poll_voters(uuid) to anon, authenticated;
notify pgrst, 'reload schema';
select 'Voter pictures are ready.' as result;
