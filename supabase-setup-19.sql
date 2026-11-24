-- Run ONCE in Supabase: SQL Editor > + New query > paste ALL > Run. (After supabase-setup-18.sql.)
-- Message notifications: the first unread message from a person notifies you, and if they keep writing,
-- you are notified again once the last notification is more than 2 minutes old.

create table if not exists public.push_last(
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  at timestamptz not null default now(),
  primary key (user_id, key)
);
alter table public.push_last enable row level security;
revoke all on public.push_last from anon, authenticated;

create or replace function public.tg_push_dm() returns trigger
language plpgsql security definer set search_path = public as $$
declare txt text;
begin
  if exists (select 1 from public.dms d
             where d.recipient_id = new.recipient_id and d.sender_id = new.sender_id and d.channel = new.channel
               and d.read_at is null and d.id <> new.id and d.created_at > now() - interval '6 hours')
     and exists (select 1 from public.push_last pl
             where pl.user_id = new.recipient_id and pl.key = 'dm-' || new.sender_id::text || '-' || new.channel
               and pl.at > now() - interval '2 minutes') then
    return new;
  end if;
  insert into public.push_last(user_id, key, at)
    values (new.recipient_id, 'dm-' || new.sender_id::text || '-' || new.channel, now())
    on conflict (user_id, key) do update set at = now();
  txt := case
    when new.kind = 'text' and new.text ~ '^\[\[st:[a-z]+[0-9]+\]\]$' then 'sent you a sticker'
    when new.kind = 'text'  then new.text
    when new.kind = 'image' then 'sent you a picture'
    when new.kind = 'item'  then 'shared an item with you'
    when new.kind = 'mm'    then 'sent you a middleman request'
    else 'sent you a message' end;
  perform public.push_send(array[new.recipient_id], 'dm',
    new.sender_name || case when new.channel = 'trade' then ' (trade)' else '' end,
    txt,
    'forum-discussions.html?u=' || new.sender_name || case when new.channel = 'trade' then '&ch=trade' else '' end,
    'dm-' || new.sender_id::text);
  return new;
exception when others then
  return new;
end $$;
drop trigger if exists push_dm on public.dms;
create trigger push_dm after insert on public.dms for each row execute function public.tg_push_dm();

create or replace function public.tg_push_group() returns trigger
language plpgsql security definer set search_path = public as $$
declare gname text; ids uuid[]; txt text;
begin
  if new.kind = 'sys' or new.sender_id is null then return new; end if;
  select name into gname from public.groups where id = new.group_id;
  select array_agg(gm.user_id) into ids from public.group_members gm
    where gm.group_id = new.group_id and gm.user_id <> new.sender_id
      and not (
        exists (select 1 from public.group_msgs m
                where m.group_id = new.group_id and m.sender_id = new.sender_id and m.kind <> 'sys'
                  and m.id <> new.id and m.created_at > gm.last_read and m.created_at > now() - interval '6 hours')
        and exists (select 1 from public.push_last pl
                where pl.user_id = gm.user_id and pl.key = 'grp-' || new.group_id::text
                  and pl.at > now() - interval '2 minutes')
      );
  if ids is null then return new; end if;
  insert into public.push_last(user_id, key, at)
    select x, 'grp-' || new.group_id::text, now() from unnest(ids) x
    on conflict (user_id, key) do update set at = now();
  txt := case
    when new.kind = 'text' and new.text ~ '^\[\[st:[a-z]+[0-9]+\]\]$' then 'sent a sticker'
    when new.kind = 'text'  then new.text
    when new.kind = 'image' then 'sent a picture'
    when new.kind = 'item'  then 'shared an item'
    else 'sent a message' end;
  perform public.push_send(ids, 'group', new.sender_name || ' in ' || coalesce(gname, 'a group'), txt,
    'forum-discussions.html', 'grp-' || new.group_id::text);
  return new;
exception when others then
  return new;
end $$;
drop trigger if exists push_group on public.group_msgs;
create trigger push_group after insert on public.group_msgs for each row execute function public.tg_push_group();
