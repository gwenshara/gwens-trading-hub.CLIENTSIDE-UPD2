-- Run ONCE in Supabase: SQL Editor > + New query > paste ALL > Run. (After supabase-setup-16.sql.) Safe to run again.
-- A middleman request now carries "what each side is giving" (payload keys give / get).
-- When both traders have confirmed, the middleman's notification includes those two lines.

create or replace function public.dm_confirm_mm(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare m record; me uuid := auth.uid(); p jsonb; gv text; gt text;
begin
  select * into m from public.dms where id = p_id and kind = 'mm' and (sender_id = me or recipient_id = me) for update;
  if not found then raise exception 'Middleman request not found.'; end if;
  p := m.payload;
  if m.sender_id = me then p := jsonb_set(p, '{s}', 'true'::jsonb); else p := jsonb_set(p, '{r}', 'true'::jsonb); end if;
  if p->>'s' = 'true' and p->>'r' = 'true' and coalesce(p->>'done','') <> '1' then
    p := p || jsonb_build_object('done', '1', 'at', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'));
    gv := left(btrim(coalesce(p->>'give','')), 300);
    gt := left(btrim(coalesce(p->>'get','')), 300);
    insert into public.notifications(user_id, kind, text, payload)
      select id, 'mm', m.sender_name || ' and ' || m.recipient_name || ' want a middleman: ' || (p->>'mm'),
             jsonb_build_object('mm', p->>'mm', 'a', m.sender_id, 'an', m.sender_name, 'b', m.recipient_id, 'bn', m.recipient_name, 'dm', m.id,
                                'give', gv, 'get', gt)
      from public.profiles where lower(username) = lower(p->>'mm');
  end if;
  update public.dms set payload = p where id = p_id;
  return p;
end $$;
revoke all on function public.dm_confirm_mm(uuid) from public, anon;
grant execute on function public.dm_confirm_mm(uuid) to authenticated;

notify pgrst, 'reload schema';
