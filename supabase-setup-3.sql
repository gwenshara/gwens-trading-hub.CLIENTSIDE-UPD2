-- Run once in the Supabase SQL Editor, AFTER the other two files.
-- Adds the request icons (Robux, Upgrade, Downgrade, Adds) to trade ads,
-- and lets an ad ask for icons only (no items) in the "looking" list.
alter table public.ads add column if not exists need jsonb not null default '[]'::jsonb;
alter table public.ads drop constraint if exists ads_looking_check;
alter table public.ads add constraint ads_looking_check check (jsonb_typeof(looking)='array' and jsonb_array_length(looking) between 0 and 30);
-- longer message on ads (300 characters)
alter table public.ads drop constraint if exists ads_note_check;
alter table public.ads add constraint ads_note_check check (char_length(note) <= 300);
