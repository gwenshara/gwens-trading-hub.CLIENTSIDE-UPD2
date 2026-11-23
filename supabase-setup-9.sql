-- Run ONCE in Supabase: SQL Editor > New query > paste ALL > Run. (After supabase-setup-8.sql.)
-- Adds to Discussions: edited messages, middleman requests, and notifications for the moderator.

-- 1) edited messages + middleman requests
alter table public.dms add column if not exists edited_at timestamptz;

alter table public.dms drop constraint if exists dms_content_check;
alter table public.dms add constraint dms_content_check check (
  char_length(text) <= 1000 and (
    (kind = 'text'  and payload is null and char_length(text) >= 1)
    or (kind = 'item'  and jsonb_typeof(payload) = 'object' and char_length(coalesce(payload->>'n','')) between 1 and 80)
    or (kind = 'image' and jsonb_typeof(payload) = 'object' and char_length(coalesce(payload->>'img','')) between 20 and 450000)
    or (kind = 'mm'    and jsonb_typeof(payload) = 'object' and char_length(coalesce(payload->>'mm','')) between 2 and 30)
  )
);

-- a new middleman request must start with nobody confirmed
drop policy if exists "dms send" on public.dms;
create policy "dms send" on public.dms for insert to authenticated
  with check (sender_id = auth.uid()
    and sender_name = (select username from public.profiles where id = auth.uid())
    and recipient_name = (select username from public.profiles where id = recipient_id)
    and (kind <> 'mm' or (coalesce(payload->>'s','') = 'false' and coalesce(payload->>'r','') = 'false')));

-- 2) edit your own message (only the text or the picture caption)
create or replace function public.dm_edit(p_id uuid, p_text text) returns timestamptz
language plpgsql security definer set search_path = public as $$
declare k text; t timestamptz := now(); s text := btrim(coalesce(p_text,''));
begin
  select kind into k from public.dms where id = p_id and sender_id = auth.uid();
  if k is null then raise exception 'You can only edit your own messages.'; end if;
  if k not in ('text','image') then raise exception 'This kind of message cannot be edited.'; end if;
  if k = 'text' and char_length(s) < 1 then raise exception 'A message cannot be empty.'; end if;
  if char_length(s) > 1000 then raise exception 'Message too long.'; end if;
  update public.dms set text = s, edited_at = t where id = p_id;
  return t;
end $$;
revoke all on function public.dm_edit(uuid, text) from public, anon;
grant execute on function public.dm_edit(uuid, text) to authenticated;

-- 3) notifications (only the person they are for can read or dismiss them)
create table if not exists public.notifications(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'mm',
  text text not null,
  payload jsonb,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);
alter table public.notifications enable row level security;
revoke all on public.notifications from anon, authenticated;
grant select, delete on public.notifications to authenticated;
drop policy if exists "notif read" on public.notifications;
drop policy if exists "notif delete" on public.notifications;
create policy "notif read" on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "notif delete" on public.notifications for delete to authenticated using (user_id = auth.uid());

-- 4) confirm a middleman request. When BOTH people have confirmed, the moderator gets a notification.
--    The moderator account is the username in the line "lower(username) = 'gwensharra'" below.
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
      from public.profiles where lower(username) = 'gwensharra';
  end if;
  update public.dms set payload = p where id = p_id;
  return p;
end $$;
revoke all on function public.dm_confirm_mm(uuid) from public, anon;
grant execute on function public.dm_confirm_mm(uuid) to authenticated;
