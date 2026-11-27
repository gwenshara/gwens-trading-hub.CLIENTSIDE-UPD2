-- Run ONCE in Supabase: SQL Editor > + New query > paste ALL > Run. Safe to run again.
-- "Wiki updates (important)" on the home page: everyone can READ, only the admin can add / edit / delete.

create table if not exists public.wiki_updates(
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  username text not null default '',
  body text not null check (char_length(body) between 1 and 2000)
);
create index if not exists wiki_updates_idx on public.wiki_updates (created_at desc, id desc);

alter table public.wiki_updates enable row level security;
grant select on public.wiki_updates to anon, authenticated;
grant insert, update, delete on public.wiki_updates to authenticated;

drop policy if exists "wu read" on public.wiki_updates;
drop policy if exists "wu insert" on public.wiki_updates;
drop policy if exists "wu update" on public.wiki_updates;
drop policy if exists "wu delete" on public.wiki_updates;
create policy "wu read" on public.wiki_updates for select to anon, authenticated using (true);
create policy "wu insert" on public.wiki_updates for insert to authenticated with check (public.is_admin());
create policy "wu update" on public.wiki_updates for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "wu delete" on public.wiki_updates for delete to authenticated using (public.is_admin());

notify pgrst, 'reload schema';
