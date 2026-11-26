-- Run ONCE in Supabase: SQL Editor > + New query > paste ALL > Run. (After supabase-setup-35.sql.)
-- Changes: banned accounts are now visible ONLY to admins (before, moderators saw them too).
-- Nothing is deleted. Safe to run again.

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
    execute format('create policy %I on public.%I as restrictive for select using ((%s) or public.is_admin())', pol, t.tbl, cond);
  end loop;
end $$;

select 'Banned accounts are now visible to admins only.' as result;
