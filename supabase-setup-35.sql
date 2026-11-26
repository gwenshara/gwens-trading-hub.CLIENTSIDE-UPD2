-- Run ONCE in Supabase: SQL Editor > + New query > paste ALL > Run. (After supabase-setup-34.sql.)
-- Adds: banned accounts disappear from the whole website for everyone except admins/moderators.
--   Their profile, messages, group chats, polls, votes, comments, trade ads, hearts, reviews,
--   reactions, friendships and follows are all hidden. Nothing is deleted, so UNBANNING brings
--   everything back exactly as it was.
-- A ban stays until a staff member unbans, and it only blocks that account (not the IP),
-- so the person can come back only by making a brand-new account (with a different username).
-- Safe to run again.

create or replace function public.is_banned_id(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select uid is not null and exists(select 1 from public.user_bans where user_id = uid)
$$;
grant execute on function public.is_banned_id(uuid) to anon, authenticated;

-- one hiding rule per table: a row is hidden when any of the listed columns points at a banned account.
-- Staff (admins + moderators) still see everything so they can find and unban people.
do $$
declare t record; cond text; c text; pol text;
begin
  for t in select * from (values
    ('profiles','id'),
    ('polls','user_id'), ('poll_votes','user_id'), ('poll_comments','user_id'),
    ('ads','user_id'), ('ad_hearts','user_id'), ('ad_reviews','reviewer_id,ad_owner'),
    ('dms','sender_id,recipient_id'),
    ('group_members','user_id'), ('group_msgs','sender_id'),
    ('msg_reactions','user_id'),
    ('friendships','requester_id,addressee_id'), ('follows','follower_id,followee_id')
  ) as v(tbl, cols) loop
    -- only touch tables that exist, have row security on, and really have these columns
    if not exists(select 1 from pg_class k join pg_namespace n on n.oid = k.relnamespace
                  where n.nspname = 'public' and k.relname = t.tbl and k.relrowsecurity) then
      raise notice 'skipped % (no table or no row security)', t.tbl; continue; end if;
    cond := '';
    foreach c in array string_to_array(t.cols, ',') loop
      if not exists(select 1 from information_schema.columns
                    where table_schema = 'public' and table_name = t.tbl and column_name = c) then
        cond := null; exit; end if;
      cond := cond || case when cond = '' then '' else ' and ' end || 'not public.is_banned_id(' || quote_ident(c) || ')';
    end loop;
    if cond is null then raise notice 'skipped % (column missing)', t.tbl; continue; end if;
    pol := 'hide banned ' || t.tbl;
    execute format('drop policy if exists %I on public.%I', pol, t.tbl);
    execute format('create policy %I on public.%I as restrictive for select using ((%s) or public.is_mod())', pol, t.tbl, cond);
  end loop;
end $$;

select 'Banned accounts are now hidden from the whole site (staff can still see them to unban).' as result;
