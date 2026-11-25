-- Run ONCE in Supabase: SQL Editor > + New query > paste ALL > Run. (After supabase-setup-13.sql.)
-- Middlemen start as "Ready to MM" instead of "Cannot MM".

alter table public.profiles alter column mm_status set default 'ready';

-- everyone who is already an official middleman and never chose a status becomes "Ready to MM"
update public.profiles set mm_status = 'ready'
where 'official_middleman' = any(roles) and mm_status = 'cannot';

notify pgrst, 'reload schema';
