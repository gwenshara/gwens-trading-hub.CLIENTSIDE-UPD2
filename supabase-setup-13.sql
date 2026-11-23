-- Run ONCE in Supabase: SQL Editor > + New query > paste ALL > Run. (After supabase-setup-12.sql.)
-- Adds: middleman availability, middleman notifications for the chosen middleman,
--       and private group chats (requester + trader + middleman) with an "Accept" button.

-- 1) middleman availability: ready / slow / cannot
alter table public.profiles add column if not exists mm_status text not null default 'cannot';
alter table public.profiles drop constraint if exists profiles_mm_status_check;
alter table public.profiles add constraint profiles_mm_status_check check (mm_status in ('ready','slow','cannot'));

-- only a member with the "official_middleman" role can set it, and only for themselves
create or replace function public.set_mm_status(s text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  if s not in ('ready','slow','cannot') then raise exception 'Unknown availability.'; end if;
  if not exists(select 1 from public.profiles where id = auth.uid() and 'official_middleman' = any(roles)) then
    raise exception 'Only official middlemen can set this.';
  end if;
  update public.profiles set mm_status = s where id = auth.uid();
end $$;
revoke all on function public.set_mm_status(text) from public, anon;
grant execute on function public.set_mm_status(text) to authenticated;

-- 2) group chats
create table if not exists public.groups(
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);
create table if not exists public.group_members(
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  username text not null,
  last_read timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index if not exists group_members_user_idx on public.group_members (user_id);
create table if not exists public.group_msgs(
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  sender_id uuid references auth.users(id) on delete set null,
  sender_name text not null,
  kind text not null default 'text' check (kind in ('text','sys')),
  text text not null check (char_length(text) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists group_msgs_idx on public.group_msgs (group_id, created_at desc);

create or replace function public.is_group_member(g uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.group_members where group_id = g and user_id = auth.uid())
$$;
revoke all on function public.is_group_member(uuid) from public, anon;
grant execute on function public.is_group_member(uuid) to authenticated;

alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_msgs enable row level security;
revoke all on public.groups, public.group_members, public.group_msgs from anon, authenticated;
grant select on public.groups to authenticated;
grant select on public.group_members to authenticated;
grant select, insert, delete on public.group_msgs to authenticated;

drop policy if exists "groups read" on public.groups;
drop policy if exists "gmembers read" on public.group_members;
drop policy if exists "gmsgs read" on public.group_msgs;
drop policy if exists "gmsgs send" on public.group_msgs;
drop policy if exists "gmsgs delete" on public.group_msgs;
create policy "groups read" on public.groups for select to authenticated using (public.is_group_member(id));
create policy "gmembers read" on public.group_members for select to authenticated using (public.is_group_member(group_id));
create policy "gmsgs read" on public.group_msgs for select to authenticated using (public.is_group_member(group_id));
create policy "gmsgs send" on public.group_msgs for insert to authenticated
  with check (sender_id = auth.uid() and kind = 'text' and public.is_group_member(group_id)
    and sender_name = (select username from public.profiles where id = auth.uid()));
create policy "gmsgs delete" on public.group_msgs for delete to authenticated using (sender_id = auth.uid() and kind = 'text');

-- mark a group as read for me
create or replace function public.group_mark_read(p_group uuid) returns void
language sql security definer set search_path = public as $$
  update public.group_members set last_read = now() where group_id = p_group and user_id = auth.uid();
$$;
revoke all on function public.group_mark_read(uuid) from public, anon;
grant execute on function public.group_mark_read(uuid) to authenticated;

-- 3) when BOTH people confirmed, the CHOSEN MIDDLEMAN gets the notification (with an Accept button)
create or replace function public.dm_confirm_mm(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare m record; me uuid := auth.uid(); p jsonb;
begin
  select * into m from public.dms where id = p_id and kind = 'mm' and (sender_id = me or recipient_id = me) for update;
  if not found then raise exception 'Middleman request not found.'; end if;
  p := m.payload;
  if m.sender_id = me then p := jsonb_set(p, '{s}', 'true'::jsonb); else p := jsonb_set(p, '{r}', 'true'::jsonb); end if;
  if p->>'s' = 'true' and p->>'r' = 'true' and coalesce(p->>'done','') <> '1' then
    p := p || '{"done":"1"}'::jsonb;
    insert into public.notifications(user_id, kind, text, payload)
      select id, 'mm', m.sender_name || ' and ' || m.recipient_name || ' want a middleman: ' || (p->>'mm'),
             jsonb_build_object('mm', p->>'mm', 'a', m.sender_id, 'an', m.sender_name, 'b', m.recipient_id, 'bn', m.recipient_name)
      from public.profiles where lower(username) = lower(p->>'mm');
  end if;
  update public.dms set payload = p where id = p_id;
  return p;
end $$;
revoke all on function public.dm_confirm_mm(uuid) from public, anon;
grant execute on function public.dm_confirm_mm(uuid) to authenticated;

-- 4) the middleman presses Accept: a group chat with all 3 is created, the notification is removed
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
  insert into public.groups(name) values ('Middleman: ' || an || ' + ' || bn) returning id into g;
  insert into public.group_members(group_id, user_id, username) values (g, a, an), (g, b, bn), (g, me, mn);
  insert into public.group_msgs(group_id, sender_id, sender_name, kind, text)
    values (g, null, mn, 'sys', mn || ' accepted the request. Group created for ' || an || ', ' || bn || ' and ' || mn || '.');
  delete from public.notifications where id = p_nid;
  return g;
end $$;
revoke all on function public.mm_accept(uuid) from public, anon;
grant execute on function public.mm_accept(uuid) to authenticated;

notify pgrst, 'reload schema';
