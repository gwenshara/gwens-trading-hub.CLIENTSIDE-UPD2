-- Run ONCE in Supabase: SQL Editor > + New query > paste ALL > Run. (After supabase-setup-13.sql.)
-- Adds: group chats anyone can create, a "middleman" group type with an official banner,
--       and closing (deleting) a group chat.

alter table public.groups add column if not exists kind text not null default 'custom';
alter table public.groups add column if not exists owner_id uuid references auth.users(id) on delete set null;
alter table public.groups drop constraint if exists groups_kind_check;
alter table public.groups add constraint groups_kind_check check (kind in ('custom','mm'));

-- groups already created by a middleman accepting (supabase-setup-13.sql) become middleman groups
update public.groups set kind = 'mm' where name like 'Middleman: %' and kind = 'custom';
update public.groups g set owner_id = (
  select gm.user_id from public.group_members gm join public.profiles p on p.id = gm.user_id
  where gm.group_id = g.id and 'official_middleman' = any(p.roles) limit 1)
where g.kind = 'mm' and g.owner_id is null;

-- the middleman accepts: official middleman group, owned by the middleman
create or replace function public.mm_accept(p_nid uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); n record; g uuid; mn text; a uuid; an text; b uuid; bn text;
begin
  select * into n from public.notifications where id = p_nid and user_id = me and kind = 'mm' for update;
  if not found then raise exception 'Notification not found.'; end if;
  a := (n.payload->>'a')::uuid; b := (n.payload->>'b')::uuid;
  an := n.payload->>'an'; bn := n.payload->>'bn';
  select username into mn from public.profiles where id = me;
  if a = me or b = me then raise exception 'A middleman cannot be one of the two traders.'; end if;
  insert into public.groups(name, kind, owner_id) values ('Middleman: ' || an || ' + ' || bn, 'mm', me) returning id into g;
  insert into public.group_members(group_id, user_id, username) values (g, a, an), (g, b, bn), (g, me, mn);
  insert into public.group_msgs(group_id, sender_id, sender_name, kind, text)
    values (g, null, mn, 'sys', mn || ' accepted the request. Group created for ' || an || ', ' || bn || ' and ' || mn || '.');
  delete from public.notifications where id = p_nid;
  return g;
end $$;
revoke all on function public.mm_accept(uuid) from public, anon;
grant execute on function public.mm_accept(uuid) to authenticated;

-- any member can create a normal group chat (up to 10 people including themselves)
create or replace function public.group_create(p_name text, p_members uuid[]) returns uuid
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); nm text := btrim(coalesce(p_name,'')); g uuid; mn text; ids uuid[]; names text;
begin
  if me is null then raise exception 'Log in first.'; end if;
  if char_length(nm) < 1 or char_length(nm) > 40 then raise exception 'Give the group a name (1 to 40 characters).'; end if;
  if lower(nm) like '%middleman%' or lower(nm) like '%official%' then
    raise exception 'That name is reserved for official middleman chats.';
  end if;
  select array_agg(distinct id) into ids from public.profiles where id = any(coalesce(p_members,'{}')) and id <> me;
  if ids is null or array_length(ids,1) < 1 then raise exception 'Add at least one person.'; end if;
  if array_length(ids,1) > 9 then raise exception 'A group can have up to 10 people.'; end if;
  if (select count(*) from public.groups where owner_id = me and kind = 'custom') >= 20 then
    raise exception 'You already own 20 groups. Close one first.';
  end if;
  select username into mn from public.profiles where id = me;
  insert into public.groups(name, kind, owner_id) values (nm, 'custom', me) returning id into g;
  insert into public.group_members(group_id, user_id, username)
    select g, id, username from public.profiles where id = me or id = any(ids);
  insert into public.group_msgs(group_id, sender_id, sender_name, kind, text)
    values (g, null, mn, 'sys', mn || ' created the group.');
  return g;
end $$;
revoke all on function public.group_create(text, uuid[]) from public, anon;
grant execute on function public.group_create(text, uuid[]) to authenticated;

-- close = delete the whole group and its messages. Only the owner (for middleman chats: the middleman).
create or replace function public.group_close(p_group uuid) returns void
language plpgsql security definer set search_path = public as $$
declare g record;
begin
  select * into g from public.groups where id = p_group;
  if not found then raise exception 'Group not found.'; end if;
  if g.owner_id is distinct from auth.uid() then
    raise exception 'Only the % can close this chat.', case when g.kind = 'mm' then 'middleman' else 'creator' end;
  end if;
  delete from public.groups where id = p_group;
end $$;
revoke all on function public.group_close(uuid) from public, anon;
grant execute on function public.group_close(uuid) to authenticated;

notify pgrst, 'reload schema';
