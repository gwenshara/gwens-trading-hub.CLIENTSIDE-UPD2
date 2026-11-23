-- Run ONCE in Supabase: SQL Editor > + New query > paste ALL > Run. (After supabase-setup-14.sql.)
-- Middleman requests: 10 minutes to accept, "didn't accept" / "didn't accept in time",
-- and a "Go to the group" link for the two traders once the middleman accepts.

-- when both confirmed: remember WHEN (the 10 minutes start now) and which chat message it is
create or replace function public.dm_confirm_mm(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare m record; me uuid := auth.uid(); p jsonb;
begin
  select * into m from public.dms where id = p_id and kind = 'mm' and (sender_id = me or recipient_id = me) for update;
  if not found then raise exception 'Middleman request not found.'; end if;
  p := m.payload;
  if m.sender_id = me then p := jsonb_set(p, '{s}', 'true'::jsonb); else p := jsonb_set(p, '{r}', 'true'::jsonb); end if;
  if p->>'s' = 'true' and p->>'r' = 'true' and coalesce(p->>'done','') <> '1' then
    p := p || jsonb_build_object('done', '1', 'at', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'));
    insert into public.notifications(user_id, kind, text, payload)
      select id, 'mm', m.sender_name || ' and ' || m.recipient_name || ' want a middleman: ' || (p->>'mm'),
             jsonb_build_object('mm', p->>'mm', 'a', m.sender_id, 'an', m.sender_name, 'b', m.recipient_id, 'bn', m.recipient_name, 'dm', m.id)
      from public.profiles where lower(username) = lower(p->>'mm');
  end if;
  update public.dms set payload = p where id = p_id;
  return p;
end $$;
revoke all on function public.dm_confirm_mm(uuid) from public, anon;
grant execute on function public.dm_confirm_mm(uuid) to authenticated;

-- Accept: only within 10 minutes. The request message then shows "Go to the group" to both traders.
create or replace function public.mm_accept(p_nid uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); n record; g uuid; mn text; a uuid; an text; b uuid; bn text;
begin
  select * into n from public.notifications where id = p_nid and user_id = me and kind = 'mm' for update;
  if not found then raise exception 'Notification not found.'; end if;
  if now() - n.created_at > interval '10 minutes' then
    raise exception 'This request expired. You have 10 minutes to accept.';
  end if;
  a := (n.payload->>'a')::uuid; b := (n.payload->>'b')::uuid;
  an := n.payload->>'an'; bn := n.payload->>'bn';
  select username into mn from public.profiles where id = me;
  if a = me or b = me then raise exception 'A middleman cannot be one of the two traders.'; end if;
  insert into public.groups(name, kind, owner_id) values ('Middleman: ' || an || ' + ' || bn, 'mm', me) returning id into g;
  insert into public.group_members(group_id, user_id, username) values (g, a, an), (g, b, bn), (g, me, mn);
  insert into public.group_msgs(group_id, sender_id, sender_name, kind, text)
    values (g, null, mn, 'sys', mn || ' accepted the request. Group created for ' || an || ', ' || bn || ' and ' || mn || '.');
  update public.dms set payload = payload || jsonb_build_object('st', 'accepted', 'gid', g)
    where id = nullif(n.payload->>'dm', '')::uuid;
  delete from public.notifications where id = p_nid;
  return g;
end $$;
revoke all on function public.mm_accept(uuid) from public, anon;
grant execute on function public.mm_accept(uuid) to authenticated;

-- Decline: the request message shows "didn't accept"
create or replace function public.mm_decline(p_nid uuid) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); n record;
begin
  select * into n from public.notifications where id = p_nid and user_id = me and kind = 'mm' for update;
  if not found then return; end if;
  update public.dms set payload = payload || jsonb_build_object('st', 'declined')
    where id = nullif(n.payload->>'dm', '')::uuid and coalesce(payload->>'st', '') = '';
  delete from public.notifications where id = p_nid;
end $$;
revoke all on function public.mm_decline(uuid) from public, anon;
grant execute on function public.mm_decline(uuid) to authenticated;

notify pgrst, 'reload schema';
