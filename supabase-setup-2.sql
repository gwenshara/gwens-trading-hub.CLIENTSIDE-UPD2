-- Run this ONCE in Supabase (SQL Editor), AFTER supabase-setup.sql. It adds shared catalog edits + the shared Log Update.
-- Everyone (even logged-out visitors) can READ. Only the admin can WRITE.

create table if not exists public.site_state(
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now(),
  updated_by text
);
create table if not exists public.site_log(
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  username text not null,
  item text not null default '',
  text text not null check (char_length(text) <= 300)
);
create index if not exists site_log_idx on public.site_log (created_at desc, id desc);

alter table public.site_state enable row level security;
alter table public.site_log enable row level security;
grant select on public.site_state, public.site_log to anon, authenticated;
grant insert, update, delete on public.site_state to authenticated;
grant insert, delete on public.site_log to authenticated;

drop policy if exists "state read" on public.site_state;
drop policy if exists "state insert" on public.site_state;
drop policy if exists "state update" on public.site_state;
drop policy if exists "state delete" on public.site_state;
create policy "state read" on public.site_state for select to anon, authenticated using (true);
create policy "state insert" on public.site_state for insert to authenticated with check (public.is_admin());
create policy "state update" on public.site_state for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "state delete" on public.site_state for delete to authenticated using (public.is_admin());

drop policy if exists "log read" on public.site_log;
drop policy if exists "log insert" on public.site_log;
drop policy if exists "log delete" on public.site_log;
create policy "log read" on public.site_log for select to anon, authenticated using (true);
create policy "log insert" on public.site_log for insert to authenticated
  with check (public.is_admin() and username = (select username from public.profiles where id = auth.uid()));
create policy "log delete" on public.site_log for delete to authenticated using (public.is_admin());
