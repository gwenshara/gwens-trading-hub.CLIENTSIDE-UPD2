-- Run ONCE in Supabase: SQL Editor > + New query > paste ALL > Run. (After supabase-setup-28.sql.) Safe to run again.
-- 1) Fixes "Unknown role." on the Value Handler role. Re-running supabase-setup-17.sql had put the old role list back.
-- 2) When a middleman accepts, the middleman group chat remembers what is being traded and shows it on top.

create or replace function public.set_roles(target text, r text[]) returns void
language plpgsql security definer set search_path = public as $$
declare ok text[] := array['official_middleman','moderator','donator','top_trader','tester','value_handler'];
begin
  if not public.is_admin() then raise exception 'Only admins can change roles.'; end if;
  if exists(select 1 from unnest(coalesce(r,'{}')) x where x <> all(ok)) then raise exception 'Unknown role.'; end if;
  update public.profiles set roles = coalesce(r,'{}') where lower(username) = lower(target);
end $$;
revoke all on function public.set_roles(text, text[]) from public, anon;
grant execute on function public.set_roles(text, text[]) to authenticated;

alter table public.groups add column if not exists trade jsonb;

create or replace function public.mm_accept(p_nid uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); n record; g uuid; mn text; a uuid; an text; b uuid; bn text; t jsonb;
begin
  select * into n from public.notifications where id = p_nid and user_id = me and kind = 'mm' for update;
  if not found then raise exception 'Notification not found.'; end if;
  if now() - n.created_at > interval '10 minutes' then
    raise exception 'This request expired. You have 10 minutes to accept.';
  end if;
  a := (n.payload->>'a')::uuid; b := (n.payload->>'b')::uuid;
  an := n.payload->>'an'; bn := n.payload->>'bn';
  select username into mn from public.profiles where id = me;
  if a = me or b = me then raise exception 'A middleman cannot be one of the two traders.'; end if;
  t := jsonb_build_object('an', an, 'bn', bn,
         'give', left(coalesce(n.payload->>'give',''), 300), 'get', left(coalesce(n.payload->>'get',''), 300));
  insert into public.groups(name, kind, owner_id, trade) values ('Middleman: ' || an || ' + ' || bn, 'mm', me, t) returning id into g;
  insert into public.group_members(group_id, user_id, username) values (g, a, an), (g, b, bn), (g, me, mn);
  insert into public.group_msgs(group_id, sender_id, sender_name, kind, text)
    values (g, null, mn, 'sys', mn || ' accepted the request. Group created for ' || an || ', ' || bn || ' and ' || mn || '.');
  update public.dms set payload = payload || jsonb_build_object('st', 'accepted', 'gid', g)
    where id = nullif(n.payload->>'dm', '')::uuid;
  delete from public.notifications where id = p_nid;
  return g;
end $$;
revoke all on function public.mm_accept(uuid) from public, anon;
grant execute on function public.mm_accept(uuid) to authenticated;

notify pgrst, 'reload schema';
