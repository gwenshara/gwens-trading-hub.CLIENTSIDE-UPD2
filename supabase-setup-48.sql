-- Run ONCE in Supabase: SQL Editor > + New query > paste ALL > Run. (After supabase-setup-46.sql.)
-- Lets EVERYONE see which accounts are linked to a member's profile (names only, no addresses).
-- Admin accounts are never listed, and admin / moderator profiles show nothing. Safe to run again.

create or replace function public.get_linked_accounts(target text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_id uuid; v_role text; v_roles text[]; v_list jsonb;
begin
  select id, role, roles into v_id, v_role, v_roles from public.profiles where lower(username) = lower(target);
  if v_id is null then return null; end if;
  if v_role = 'admin' or 'moderator' = any(coalesce(v_roles, '{}')) then return null; end if;
  select coalesce(jsonb_agg(p.username order by lower(p.username)), '[]'::jsonb) into v_list
  from public.profiles p
  where p.id in (select public.linked_account_ids(v_id)) and p.role <> 'admin';
  return jsonb_build_object('accounts', v_list);
end $$;

revoke all on function public.get_linked_accounts(text) from public;
grant execute on function public.get_linked_accounts(text) to anon, authenticated;
notify pgrst, 'reload schema';
