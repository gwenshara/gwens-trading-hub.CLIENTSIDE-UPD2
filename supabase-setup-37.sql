-- Run ONCE in Supabase: SQL Editor > + New query > paste ALL > Run. (After supabase-setup-36.sql.)
-- Adds: admins can permanently delete several accounts at once (Members > "Staff: IPs & bulk ban").
-- Deleting removes the account and everything of theirs for good (it can NOT be undone).
-- Only admins; admin accounts and your own account are always skipped. Safe to run again.

create or replace function public.delete_many(targets text[]) returns jsonb
language plpgsql security definer set search_path = public as $$
declare t public.profiles%rowtype; nm text; n int := 0; skipped int := 0;
begin
  if not public.is_admin() then raise exception 'Only admins can delete accounts.'; end if;
  if coalesce(array_length(targets, 1), 0) > 100 then raise exception 'Select at most 100 accounts at a time.'; end if;
  foreach nm in array coalesce(targets, '{}') loop
    select * into t from public.profiles where lower(username) = lower(nm);
    if not found or t.id = auth.uid() or t.role = 'admin' then skipped := skipped + 1; continue; end if;
    perform public.purge_user(t.id);
    n := n + 1;
  end loop;
  return jsonb_build_object('deleted', n, 'skipped', skipped);
end $$;
revoke all on function public.delete_many(text[]) from public, anon;
grant execute on function public.delete_many(text[]) to authenticated;

select 'Bulk account deletion is ready (admins only).' as result;
