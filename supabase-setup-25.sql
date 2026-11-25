-- Run ONCE in Supabase: SQL Editor > + New query > paste ALL > Run. Safe to run again.
-- Fixes: 'new row for relation "group_msgs" violates check constraint "group_msgs_content_check"'
-- when replying to a message in a group chat (a reply stores its info in payload).
do $$ declare c record; begin
  for c in select conname from pg_constraint where conrelid = 'public.group_msgs'::regclass and contype = 'c'
  loop execute format('alter table public.group_msgs drop constraint %I', c.conname); end loop;
end $$;

alter table public.group_msgs add constraint group_msgs_content_check check (
  char_length(text) <= 1000 and kind in ('text','sys','item','image') and (
    (kind = 'text' and char_length(text) >= 1 and (payload is null or jsonb_typeof(payload) = 'object'))
    or (kind = 'sys' and payload is null and char_length(text) >= 1)
    or (kind = 'item'  and jsonb_typeof(payload) = 'object' and char_length(coalesce(payload->>'n','')) between 1 and 80)
    or (kind = 'image' and jsonb_typeof(payload) = 'object' and char_length(coalesce(payload->>'img','')) between 20 and 450000)
  )
);

notify pgrst, 'reload schema';
