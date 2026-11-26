-- Run ONCE in Supabase: SQL Editor > + New query > paste ALL > Run. (After supabase-setup-29.sql.) Safe to run again.
-- 1) A middleman can name the group chat when accepting.
-- 2) The owner of a group (the creator, or the middleman in a middleman chat) can change its name and picture.

alter table public.groups add column if not exists image text;

drop function if exists public.mm_accept(uuid);
drop function if exists public.mm_accept(uuid, text);
create or replace function public.mm_accept(p_nid uuid, p_name text default '') returns uuid
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); n record; g uuid; mn text; a uuid; an text; b uuid; bn text; t jsonb; gname text := btrim(coalesce(p_name,''));
begin
  select * into n from public.notifications where id = p_nid and user_id = me and kind = 'mm' for update;
  if not found then raise exception 'Notification not found.'; end if;
  if now() - n.created_at > interval '10 minutes' then
    raise exception 'This request expired. You have 10 minutes to accept.';
  end if;
  if char_length(gname) > 40 then raise exception 'Group name too long (40 characters max).'; end if;
  a := (n.payload->>'a')::uuid; b := (n.payload->>'b')::uuid;
  an := n.payload->>'an'; bn := n.payload->>'bn';
  select username into mn from public.profiles where id = me;
  if a = me or b = me then raise exception 'A middleman cannot be one of the two traders.'; end if;
  if gname = '' then gname := 'Middleman: ' || an || ' + ' || bn; end if;
  t := jsonb_build_object('an', an, 'bn', bn,
         'give', left(coalesce(n.payload->>'give',''), 300), 'get', left(coalesce(n.payload->>'get',''), 300));
  insert into public.groups(name, kind, owner_id, trade) values (gname, 'mm', me, t) returning id into g;
  insert into public.group_members(group_id, user_id, username) values (g, a, an), (g, b, bn), (g, me, mn);
  insert into public.group_msgs(group_id, sender_id, sender_name, kind, text)
    values (g, null, mn, 'sys', mn || ' accepted the request. Group created for ' || an || ', ' || bn || ' and ' || mn || '.');
  update public.dms set payload = payload || jsonb_build_object('st', 'accepted', 'gid', g)
    where id = nullif(n.payload->>'dm', '')::uuid;
  delete from public.notifications where id = p_nid;
  return g;
end $$;
revoke all on function public.mm_accept(uuid, text) from public, anon;
grant execute on function public.mm_accept(uuid, text) to authenticated;

-- change name and/or picture. p_image: '' = keep, 'none' = remove, otherwise a small data:image/... picture
create or replace function public.group_update(p_group uuid, p_name text default '', p_image text default '') returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); g record; nm text := btrim(coalesce(p_name,'')); im text := coalesce(p_image,'');
begin
  select * into g from public.groups where id = p_group for update;
  if not found then raise exception 'Group not found.'; end if;
  if g.owner_id is distinct from me then
    raise exception 'Only the % can change this group.', case when g.kind = 'mm' then 'middleman' else 'creator' end;
  end if;
  if nm <> '' then
    if char_length(nm) > 40 then raise exception 'Group name too long (40 characters max).'; end if;
    update public.groups set name = nm where id = p_group;
  end if;
  if im = 'none' then
    update public.groups set image = null where id = p_group;
  elsif im <> '' then
    if im !~ '^data:image/(jpeg|png|webp);base64,' or char_length(im) > 60000 then
      raise exception 'That picture is not valid or too big.';
    end if;
    update public.groups set image = im where id = p_group;
  end if;
end $$;
revoke all on function public.group_update(uuid, text, text) from public, anon;
grant execute on function public.group_update(uuid, text, text) to authenticated;

notify pgrst, 'reload schema';
