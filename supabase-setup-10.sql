-- Run ONCE in Supabase: SQL Editor > New query > paste ALL > Run. (After supabase-setup-9.sql.)
-- Adds: hearts on trade ads, and "trading" chats (a separate chat channel next to personal messages).

-- 1) hearts on trade ads
create table if not exists public.ad_hearts(
  ad_id uuid not null references public.ads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (ad_id, user_id)
);
create index if not exists ad_hearts_ad_idx on public.ad_hearts (ad_id);
alter table public.ad_hearts enable row level security;
grant select, insert, delete on public.ad_hearts to authenticated;
drop policy if exists "hearts read" on public.ad_hearts;
drop policy if exists "hearts add" on public.ad_hearts;
drop policy if exists "hearts remove" on public.ad_hearts;
create policy "hearts read" on public.ad_hearts for select to authenticated using (true);
create policy "hearts add" on public.ad_hearts for insert to authenticated with check (user_id = auth.uid());
create policy "hearts remove" on public.ad_hearts for delete to authenticated using (user_id = auth.uid());

-- 2) chat channel: 'personal' (default, all your old messages) or 'trade'
alter table public.dms add column if not exists channel text not null default 'personal';
alter table public.dms drop constraint if exists dms_channel_check;
alter table public.dms add constraint dms_channel_check check (channel in ('personal','trade'));
create index if not exists dms_channel_idx on public.dms (channel);
