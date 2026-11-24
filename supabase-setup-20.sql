-- Run ONCE in Supabase: SQL Editor > + New query > paste ALL > Run. (After supabase-setup-17.sql.)
-- Adds the "Value Handler" role: can edit prices/stars/info, add or delete items, change icons,
-- showcase videos and fun facts for everyone, and writes to the Log Update.
-- Admins give it from Profile > Manage roles (same place as Tester, Moderator...).

-- 1) the role can now be given
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

-- 2) "can this person edit the catalog?" = admin OR value handler
create or replace function public.can_edit_catalog() returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles
    where id = auth.uid() and (role = 'admin' or 'value_handler' = any(roles)))
$$;

-- 3) catalog data (edits, added items, icons, videos, fun facts)
drop policy if exists "state insert" on public.site_state;
drop policy if exists "state update" on public.site_state;
drop policy if exists "state delete" on public.site_state;
create policy "state insert" on public.site_state for insert to authenticated with check (public.can_edit_catalog());
create policy "state update" on public.site_state for update to authenticated using (public.can_edit_catalog()) with check (public.can_edit_catalog());
create policy "state delete" on public.site_state for delete to authenticated using (public.can_edit_catalog());

-- 4) Log Update: value handlers can write entries under their own name (only admins can clear the log)
drop policy if exists "log insert" on public.site_log;
create policy "log insert" on public.site_log for insert to authenticated
  with check (public.can_edit_catalog() and username = (select username from public.profiles where id = auth.uid()));

-- 5) showcase videos (storage bucket "showcase"): extra rules for value handlers, the admin's rules stay as they are
drop policy if exists "showcase handler insert" on storage.objects;
drop policy if exists "showcase handler update" on storage.objects;
drop policy if exists "showcase handler delete" on storage.objects;
create policy "showcase handler insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'showcase' and public.can_edit_catalog());
create policy "showcase handler update" on storage.objects for update to authenticated
  using (bucket_id = 'showcase' and public.can_edit_catalog()) with check (bucket_id = 'showcase' and public.can_edit_catalog());
create policy "showcase handler delete" on storage.objects for delete to authenticated
  using (bucket_id = 'showcase' and public.can_edit_catalog());
