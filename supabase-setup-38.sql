-- Run ONCE in Supabase: SQL Editor > + New query > paste ALL > Run. (After supabase-setup-37.sql.)
-- Adds a server-side anti-spam limit to private chats and group chats, so it can't be skipped:
--   * at least ~0.7 seconds between two messages of the same person
--   * at most 8 messages in 10 seconds
-- The person gets the message "Don't spam! Each message is precious ...".
-- Automatic messages (trade-ad cards, middleman notices) are not limited. Safe to run again.

create index if not exists dms_sender_time_idx on public.dms (sender_id, created_at desc);
create index if not exists group_msgs_sender_time_idx on public.group_msgs (sender_id, created_at desc);

create or replace function public.limit_chat_spam() returns trigger
language plpgsql security definer set search_path = public as $$
declare last_t timestamptz; cnt int; tbl text := tg_table_name; j jsonb := to_jsonb(new);
begin
  if new.sender_id is null then return new; end if;
  if coalesce(j->>'text', '') like '[[ad:%' then return new; end if;
  if coalesce(j->>'kind', 'text') not in ('text', 'image', 'item') then return new; end if;
  if tbl = 'dms' then
    select max(created_at), count(*) filter (where created_at > now() - interval '10 seconds')
      into last_t, cnt from public.dms where sender_id = new.sender_id and created_at > now() - interval '1 minute';
  else
    select max(created_at), count(*) filter (where created_at > now() - interval '10 seconds')
      into last_t, cnt from public.group_msgs where sender_id = new.sender_id and created_at > now() - interval '1 minute';
  end if;
  if last_t is not null and now() - last_t < interval '700 milliseconds' then
    raise exception 'Slow down: wait 1 second between messages.';
  end if;
  if coalesce(cnt, 0) >= 8 then
    raise exception 'Don''t spam! Each message is precious, so please make sure you don''t abuse the message feature.';
  end if;
  return new;
end $$;

drop trigger if exists limit_dms_spam on public.dms;
create trigger limit_dms_spam before insert on public.dms for each row execute function public.limit_chat_spam();
drop trigger if exists limit_group_spam on public.group_msgs;
create trigger limit_group_spam before insert on public.group_msgs for each row execute function public.limit_chat_spam();

select 'Anti-spam limit is on for private and group chats.' as result;
