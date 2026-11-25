-- Run ONCE in Supabase: SQL Editor > New query > paste ALL > Run. Safe to run again.
-- Adds star reviews on trade ads (shown in "View details" and on the ad owner's profile).
-- Hearts already exist (supabase-setup-10.sql). Run that one too if you never did.

create table if not exists public.ad_reviews(
  id uuid primary key default gen_random_uuid(),
  ad_id uuid not null references public.ads(id) on delete cascade,
  ad_owner uuid not null references auth.users(id) on delete cascade,
  reviewer_id uuid not null references auth.users(id) on delete cascade,
  reviewer_name text not null,
  stars int not null check (stars between 1 and 5),
  comment text not null default '' check (char_length(comment) <= 300),
  created_at timestamptz not null default now(),
  unique (ad_id, reviewer_id)
);
create index if not exists ad_reviews_ad_idx on public.ad_reviews (ad_id);
create index if not exists ad_reviews_owner_idx on public.ad_reviews (ad_owner);
alter table public.ad_reviews enable row level security;
grant select, insert, update, delete on public.ad_reviews to authenticated;

drop policy if exists "reviews read" on public.ad_reviews;
drop policy if exists "reviews add" on public.ad_reviews;
drop policy if exists "reviews edit" on public.ad_reviews;
drop policy if exists "reviews remove" on public.ad_reviews;
create policy "reviews read" on public.ad_reviews for select to authenticated using (true);
create policy "reviews add" on public.ad_reviews for insert to authenticated
  with check (reviewer_id = auth.uid() and ad_owner <> auth.uid()
    and exists (select 1 from public.ads a where a.id = ad_id and a.user_id = ad_owner));
create policy "reviews edit" on public.ad_reviews for update to authenticated
  using (reviewer_id = auth.uid()) with check (reviewer_id = auth.uid());
create policy "reviews remove" on public.ad_reviews for delete to authenticated
  using (reviewer_id = auth.uid() or public.is_admin());

notify pgrst, 'reload schema';
