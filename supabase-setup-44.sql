-- Run ONCE in Supabase: SQL Editor > + New query > paste ALL > Run. Safe to run again.
-- Needs supabase-setup-41.sql (wiki updates).
-- Likes on the wiki updates: everyone can see the counts, only logged-in people can like (one like each).

create table if not exists public.wiki_update_likes(
  update_id bigint not null references public.wiki_updates(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (update_id, user_id)
);
create index if not exists wiki_update_likes_user_idx on public.wiki_update_likes (user_id);

alter table public.wiki_update_likes enable row level security;
grant select on public.wiki_update_likes to anon, authenticated;
grant insert, delete on public.wiki_update_likes to authenticated;

drop policy if exists "wul read" on public.wiki_update_likes;
drop policy if exists "wul insert" on public.wiki_update_likes;
drop policy if exists "wul delete" on public.wiki_update_likes;
create policy "wul read" on public.wiki_update_likes for select to anon, authenticated using (true);
create policy "wul insert" on public.wiki_update_likes for insert to authenticated with check (user_id = auth.uid());
create policy "wul delete" on public.wiki_update_likes for delete to authenticated using (user_id = auth.uid());

notify pgrst, 'reload schema';
select 'Likes on wiki updates are ready.' as result;
