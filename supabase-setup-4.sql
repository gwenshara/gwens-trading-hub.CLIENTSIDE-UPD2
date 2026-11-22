-- Run once in the Supabase SQL Editor, AFTER the other files.
-- Adds profile picture, banner and bio to accounts. People can change only these three columns on their own row.
alter table public.profiles add column if not exists avatar text check (avatar is null or char_length(avatar) <= 300000);
alter table public.profiles add column if not exists banner text check (banner is null or char_length(banner) <= 600000);
alter table public.profiles add column if not exists bio text check (bio is null or char_length(bio) <= 200);
grant update (avatar, banner, bio) on public.profiles to authenticated;
drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
