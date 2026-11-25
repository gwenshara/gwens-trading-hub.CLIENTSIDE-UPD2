-- Run ONCE in Supabase: SQL Editor > + New query > paste ALL > Run. (After supabase-setup-13.sql and supabase-setup-14.sql.)
-- Adds: the "Tester" role, pictures / items / stickers / editing in group chats,
--       and message reactions (laugh, heart, check, cross) in private chats and group chats.

-- 1) "Tester" role (admins give it from Profile > Manage roles)
create or replace function public.set_roles(target text, r text[]) returns void
language plpgsql security definer set search_path = public as $$
declare ok text[] := array['official_middleman','moderator','donator','top_trader','tester','value_handler'];
begin
  if not public.is_admin() then raise exception 'Only admins can change roles.'; end if;
  if exists(select 1 from unnest(coalesce(r,'{}')) x where x <> all(ok)) then raise exception 'Unknown role.'; end if;
  update public.profiles set roles = coalesce(r,'{}') where lower(username) = lower(target);
end $$;

-- 2) group chats: pictures, items and edited messages
alter table public.group_msgs add column if not exists payload jsonb;
alter table public.group_msgs add column if not exists edited_at timestamptz;

do $$ declare c record; begin
  for c in select conname from pg_constraint where conrelid = 'public.group_msgs'::regclass and contype = 'c'
  loop execute format('alter table public.group_msgs drop constraint %I', c.conname); end loop;
end $$;
alter table public.group_msgs drop constraint if exists group_msgs_content_check;
alter table public.group_msgs add constraint group_msgs_content_check check (
  char_length(text) <= 1000 and kind in ('text','sys','item','image') and (
    (kind in ('text','sys') and payload is null and char_length(text) >= 1)
    or (kind = 'item'  and jsonb_typeof(payload) = 'object' and char_length(coalesce(payload->>'n','')) between 1 and 80)
    or (kind = 'image' and jsonb_typeof(payload) = 'object' and char_length(coalesce(payload->>'img','')) between 20 and 450000)
  )
);

drop policy if exists "gmsgs send" on public.group_msgs;
create policy "gmsgs send" on public.group_msgs for insert to authenticated
  with check (sender_id = auth.uid() and kind in ('text','item','image') and public.is_group_member(group_id)
    and sender_name = (select username from public.profiles where id = auth.uid()));
drop policy if exists "gmsgs delete" on public.group_msgs;
create policy "gmsgs delete" on public.group_msgs for delete to authenticated
  using (sender_id = auth.uid() and kind <> 'sys');

-- edit your own group message (text, or the caption of a picture)
create or replace function public.group_msg_edit(p_id uuid, p_text text) returns timestamptz
language plpgsql security definer set search_path = public as $$
declare k text; t timestamptz := now(); s text := btrim(coalesce(p_text,''));
begin
  select kind into k from public.group_msgs where id = p_id and sender_id = auth.uid() and public.is_group_member(group_id);
  if k is null then raise exception 'You can only edit your own messages.'; end if;
  if k not in ('text','image') then raise exception 'This kind of message cannot be edited.'; end if;
  if k = 'text' and char_length(s) < 1 then raise exception 'A message cannot be empty.'; end if;
  if char_length(s) > 1000 then raise exception 'Message too long.'; end if;
  update public.group_msgs set text = s, edited_at = t where id = p_id;
  return t;
end $$;
revoke all on function public.group_msg_edit(uuid, text) from public, anon;
grant execute on function public.group_msg_edit(uuid, text) to authenticated;

-- 3) reactions (private chats: scope 'dm', group chats: scope 'grp')
create table if not exists public.msg_reactions(
  msg_id uuid not null,
  scope text not null check (scope in ('dm','grp')),
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null check (emoji in ('laugh','heart','check','cross')),
  created_at timestamptz not null default now(),
  primary key (msg_id, user_id, emoji)
);
create index if not exists msg_reactions_msg_idx on public.msg_reactions (msg_id);
alter table public.msg_reactions enable row level security;
revoke all on public.msg_reactions from anon, authenticated;
grant select on public.msg_reactions to authenticated;

drop policy if exists "rx read" on public.msg_reactions;
create policy "rx read" on public.msg_reactions for select to authenticated using (
  (msg_reactions.scope = 'dm' and exists(select 1 from public.dms d
     where d.id = msg_reactions.msg_id and (d.sender_id = auth.uid() or d.recipient_id = auth.uid())))
  or (msg_reactions.scope = 'grp' and exists(select 1 from public.group_msgs g
     where g.id = msg_reactions.msg_id and public.is_group_member(g.group_id)))
);

-- press an emoji = add it, press it again = remove it. Only people who can see the message can react.
create or replace function public.msg_react(p_scope text, p_id uuid, p_emoji text) returns boolean
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); ok boolean := false;
begin
  if me is null then raise exception 'Log in first.'; end if;
  if p_emoji not in ('laugh','heart','check','cross') then raise exception 'Unknown reaction.'; end if;
  if p_scope = 'dm' then
    select exists(select 1 from public.dms where id = p_id and kind <> 'mm' and (sender_id = me or recipient_id = me)) into ok;
  elsif p_scope = 'grp' then
    select exists(select 1 from public.group_msgs where id = p_id and kind <> 'sys' and public.is_group_member(group_id)) into ok;
  else
    raise exception 'Unknown message type.';
  end if;
  if not ok then raise exception 'You cannot react to this message.'; end if;
  if exists(select 1 from public.msg_reactions where msg_id = p_id and user_id = me and emoji = p_emoji) then
    delete from public.msg_reactions where msg_id = p_id and user_id = me and emoji = p_emoji;
    return false;
  end if;
  insert into public.msg_reactions(msg_id, scope, user_id, emoji) values (p_id, p_scope, me, p_emoji);
  return true;
end $$;
revoke all on function public.msg_react(text, uuid, text) from public, anon;
grant execute on function public.msg_react(text, uuid, text) to authenticated;

-- read the reactions of a list of messages (only the ones you are allowed to see come back)
create or replace function public.msg_reactions_get(p_scope text, p_ids uuid[]) returns setof public.msg_reactions
language sql stable security invoker set search_path = public as $$
  select * from public.msg_reactions where scope = p_scope and msg_id = any(p_ids)
$$;
revoke all on function public.msg_reactions_get(text, uuid[]) from public, anon;
grant execute on function public.msg_reactions_get(text, uuid[]) to authenticated;

-- when a message is deleted, its reactions go too
create or replace function public.msg_reactions_cleanup() returns trigger
language plpgsql security definer set search_path = public as $$
begin delete from public.msg_reactions where msg_id = old.id; return old; end $$;
drop trigger if exists dms_rx_cleanup on public.dms;
create trigger dms_rx_cleanup after delete on public.dms for each row execute function public.msg_reactions_cleanup();
drop trigger if exists group_msgs_rx_cleanup on public.group_msgs;
create trigger group_msgs_rx_cleanup after delete on public.group_msgs for each row execute function public.msg_reactions_cleanup();

notify pgrst, 'reload schema';
