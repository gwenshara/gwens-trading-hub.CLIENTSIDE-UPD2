-- Run ONCE in Supabase: SQL Editor > + New query > paste ALL > Run. Safe to run again.
-- "Change the icon of the site": everyone can READ the chosen icon, only the admin can CHANGE it.

create table if not exists public.site_settings(
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table public.site_settings enable row level security;
grant select on public.site_settings to anon, authenticated;
revoke insert, update, delete on public.site_settings from anon, authenticated;

drop policy if exists "ss read" on public.site_settings;
create policy "ss read" on public.site_settings for select to anon, authenticated using (true);

insert into public.site_settings(key, value) values ('site_icon', 'normal')
on conflict (key) do nothing;

-- the only way to change it, and it checks that you are the admin on the server
create or replace function public.set_site_icon(p_icon text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Only the admin can change the site icon.';
  end if;
  if p_icon not in ('normal', 'winter') then
    raise exception 'Unknown icon.';
  end if;
  insert into public.site_settings(key, value, updated_at) values ('site_icon', p_icon, now())
  on conflict (key) do update set value = excluded.value, updated_at = now();
  return jsonb_build_object('icon', p_icon);
end $$;

revoke all on function public.set_site_icon(text) from public, anon;
grant execute on function public.set_site_icon(text) to authenticated;

notify pgrst, 'reload schema';
