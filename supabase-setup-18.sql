-- Run ONCE in Supabase: SQL Editor > + New query > paste ALL > Run. (After supabase-setup-17.sql.)
-- Push notifications: a table for each device's push address, the settings buttons use, and
-- the triggers that tell the "push-notify" Edge Function when something new happens.
-- This file contains NO secret, so it is safe to keep in GitHub. The secret is set separately (see the steps).

create extension if not exists pg_net with schema extensions;

-- 1) devices that said "yes, notify me" (one row per browser / phone)
create table if not exists public.push_subs(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  prefs jsonb not null default '{"dm":true,"group":true,"mm":true,"vote":true}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists push_subs_user_idx on public.push_subs (user_id);
alter table public.push_subs enable row level security;
revoke all on public.push_subs from anon, authenticated;

-- 2) where the Edge Function lives + the shared secret (nobody can read this table from the website)
create table if not exists public.push_config(key text primary key, value text not null);
alter table public.push_config enable row level security;
revoke all on public.push_config from anon, authenticated;
insert into public.push_config(key, value) values ('url', 'https://fopalskmdgkxnnxzmgfc.supabase.co/functions/v1/push-notify')
  on conflict (key) do update set value = excluded.value;
insert into public.push_config(key, value) values ('secret', 'NOT-SET-YET')
  on conflict (key) do nothing;

-- 3) functions the website calls (each person can only touch their own devices)
create or replace function public.push_subscribe(p_endpoint text, p_p256dh text, p_auth text, p_prefs jsonb default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); np jsonb; r jsonb;
begin
  if me is null then raise exception 'Log in first.'; end if;
  if p_endpoint is null or char_length(p_endpoint) > 1000 or p_endpoint !~ '^https://' then raise exception 'Bad push address.'; end if;
  if p_prefs is not null then
    np := jsonb_build_object(
      'dm',    coalesce(p_prefs->>'dm', 'true')    <> 'false',
      'group', coalesce(p_prefs->>'group', 'true') <> 'false',
      'mm',    coalesce(p_prefs->>'mm', 'true')    <> 'false',
      'vote',  coalesce(p_prefs->>'vote', 'true')  <> 'false');
  end if;
  insert into public.push_subs(user_id, endpoint, p256dh, auth, prefs)
  values (me, p_endpoint, p_p256dh, p_auth, coalesce(np, '{"dm":true,"group":true,"mm":true,"vote":true}'::jsonb))
  on conflict (endpoint) do update set
    p256dh = excluded.p256dh,
    auth = excluded.auth,
    prefs = case when np is not null then np
                 when public.push_subs.user_id = me then public.push_subs.prefs
                 else excluded.prefs end,
    user_id = me
  returning prefs into r;
  return r;
end $$;
revoke all on function public.push_subscribe(text, text, text, jsonb) from public, anon;
grant execute on function public.push_subscribe(text, text, text, jsonb) to authenticated;

create or replace function public.push_unsubscribe(p_endpoint text) returns void
language sql security definer set search_path = public as $$
  delete from public.push_subs where endpoint = p_endpoint and user_id = auth.uid();
$$;
revoke all on function public.push_unsubscribe(text) from public, anon;
grant execute on function public.push_unsubscribe(text) to authenticated;

create or replace function public.push_set_prefs(p_endpoint text, p_prefs jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare np jsonb; r jsonb;
begin
  np := jsonb_build_object(
    'dm',    coalesce(p_prefs->>'dm', 'true')    <> 'false',
    'group', coalesce(p_prefs->>'group', 'true') <> 'false',
    'mm',    coalesce(p_prefs->>'mm', 'true')    <> 'false',
    'vote',  coalesce(p_prefs->>'vote', 'true')  <> 'false');
  update public.push_subs set prefs = np where endpoint = p_endpoint and user_id = auth.uid() returning prefs into r;
  return r;
end $$;
revoke all on function public.push_set_prefs(text, jsonb) from public, anon;
grant execute on function public.push_set_prefs(text, jsonb) to authenticated;

-- 4) the one function that asks the Edge Function to send. It skips people on "Do not disturb"
--    and people who switched that kind of notification off. A failure here never blocks a message.
create or replace function public.push_send(p_users uuid[], p_kind text, p_title text, p_body text, p_url text, p_tag text) returns void
language plpgsql security definer set search_path = public as $$
declare u text; s text; ids uuid[];
begin
  if p_users is null or coalesce(array_length(p_users, 1), 0) = 0 then return; end if;
  select value into u from public.push_config where key = 'url';
  select value into s from public.push_config where key = 'secret';
  if u is null or s is null or s = 'NOT-SET-YET' then return; end if;
  select array_agg(distinct ps.user_id) into ids
    from public.push_subs ps join public.profiles p on p.id = ps.user_id
    where ps.user_id = any(p_users)
      and p.status <> 'dnd'
      and coalesce(ps.prefs->>p_kind, 'true') <> 'false';
  if ids is null then return; end if;
  perform net.http_post(
    url := u,
    body := jsonb_build_object('user_ids', to_jsonb(ids), 'kind', p_kind, 'title', left(coalesce(p_title, ''), 80),
                               'body', left(coalesce(p_body, ''), 180), 'url', p_url, 'tag', p_tag),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', s));
exception when others then
  return;
end $$;
revoke all on function public.push_send(uuid[], text, text, text, text, text) from public, anon, authenticated;

-- 5) a test button on the website: sends YOU a notification through the whole chain
create or replace function public.push_test() returns void
language plpgsql security definer set search_path = public as $$
declare u text; s text;
begin
  if auth.uid() is null then raise exception 'Log in first.'; end if;
  select value into u from public.push_config where key = 'url';
  select value into s from public.push_config where key = 'secret';
  if s is null or s = 'NOT-SET-YET' then raise exception 'The push secret is not set yet (step 4 of the setup).'; end if;
  perform net.http_post(
    url := u,
    body := jsonb_build_object('user_ids', jsonb_build_array(auth.uid()), 'kind', 'test', 'title', 'Test notification',
                               'body', 'It works! You will get alerts like this.', 'url', 'forum-discussions.html', 'tag', 'test'),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', s));
end $$;
revoke all on function public.push_test() from public, anon;
grant execute on function public.push_test() to authenticated;

-- 6) triggers
-- 6a) private messages: only the FIRST unread message from a person notifies you.
--     (If you ignored them for 6 hours, the next one notifies again.)
create or replace function public.tg_push_dm() returns trigger
language plpgsql security definer set search_path = public as $$
declare txt text;
begin
  if exists (select 1 from public.dms d
             where d.recipient_id = new.recipient_id and d.sender_id = new.sender_id and d.channel = new.channel
               and d.read_at is null and d.id <> new.id and d.created_at > now() - interval '6 hours') then
    return new;
  end if;
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

-- 6b) group chats: same rule per person per group (system lines never notify)
create or replace function public.tg_push_group() returns trigger
language plpgsql security definer set search_path = public as $$
declare gname text; ids uuid[]; txt text;
begin
  if new.kind = 'sys' or new.sender_id is null then return new; end if;
  select name into gname from public.groups where id = new.group_id;
  select array_agg(gm.user_id) into ids from public.group_members gm
    where gm.group_id = new.group_id and gm.user_id <> new.sender_id
      and not exists (select 1 from public.group_msgs m
                      where m.group_id = new.group_id and m.sender_id = new.sender_id and m.kind <> 'sys'
                        and m.id <> new.id and m.created_at > gm.last_read and m.created_at > now() - interval '6 hours');
  if ids is null then return new; end if;
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

-- 6c) middleman requests (the notification the middleman gets with the Accept button)
create or replace function public.tg_push_notif() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.kind = 'mm' then
    perform public.push_send(array[new.user_id], 'mm', 'Middleman request', new.text,
      'forum-discussions.html', 'mm-' || new.id::text);
  end if;
  return new;
exception when others then
  return new;
end $$;
drop trigger if exists push_notif on public.notifications;
create trigger push_notif after insert on public.notifications for each row execute function public.tg_push_notif();

-- 6d) new value vote: everyone who turned notifications on (except the person who made it)
create or replace function public.tg_push_poll() returns trigger
language plpgsql security definer set search_path = public as $$
declare ids uuid[];
begin
  select array_agg(distinct ps.user_id) into ids from public.push_subs ps where ps.user_id <> new.user_id;
  if ids is null then return new; end if;
  perform public.push_send(ids, 'vote', 'New value vote',
    new.username || ' asks to change ' || new.item || ' (' || new.kind || '): '
      || coalesce(nullif(new.current_val, ''), '?') || ' -> ' || new.proposed,
    'forum-voting.html', 'vote');
  return new;
exception when others then
  return new;
end $$;
drop trigger if exists push_poll on public.polls;
create trigger push_poll after insert on public.polls for each row execute function public.tg_push_poll();

notify pgrst, 'reload schema';
