-- Run ONCE in Supabase: SQL Editor > + New query > paste ALL > Run. (After supabase-setup-16.sql.) Safe to run again.
-- A middleman who does not accept must write an excuse. It is sent to BOTH traders as a private message from the middleman.

drop function if exists public.mm_decline(uuid);
drop function if exists public.mm_decline(uuid, text);
create or replace function public.mm_decline(p_nid uuid, p_reason text default '') returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); n record; mn text; r text := btrim(coalesce(p_reason,'')); a uuid; b uuid; an text; bn text; t text;
begin
  select * into n from public.notifications where id = p_nid and user_id = me and kind = 'mm' for update;
  if not found then return; end if;
  if char_length(r) < 3 then raise exception 'Write an excuse first (at least 3 letters).'; end if;
  if char_length(r) > 400 then raise exception 'Excuse too long (400 characters max).'; end if;
  select username into mn from public.profiles where id = me;
  a := nullif(n.payload->>'a','')::uuid; b := nullif(n.payload->>'b','')::uuid;
  an := n.payload->>'an'; bn := n.payload->>'bn';
  t := 'Middleman request declined by ' || mn || '. Excuse: ' || r;
  if a is not null and a <> me then
    insert into public.dms(sender_id, recipient_id, sender_name, recipient_name, text, kind)
      values (me, a, mn, an, t, 'text');
  end if;
  if b is not null and b <> me then
    insert into public.dms(sender_id, recipient_id, sender_name, recipient_name, text, kind)
      values (me, b, mn, bn, t, 'text');
  end if;
  update public.dms set payload = payload || jsonb_build_object('st', 'declined')
    where id = nullif(n.payload->>'dm', '')::uuid and coalesce(payload->>'st', '') = '';
  delete from public.notifications where id = p_nid;
end $$;
revoke all on function public.mm_decline(uuid, text) from public, anon;
grant execute on function public.mm_decline(uuid, text) to authenticated;

notify pgrst, 'reload schema';
