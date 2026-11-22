-- Run ONCE in Supabase: SQL Editor > New query > paste > Run. (After the other setup files.)
-- Discussions = private 1-to-1 messages between members. Only the two people in a conversation can read it.

create table if not exists public.dms(
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  sender_name text not null,
  recipient_name text not null,
  text text not null check (char_length(text) between 1 and 1000),
  created_at timestamptz not null default now(),
  check (sender_id <> recipient_id)
);
create index if not exists dms_sender_idx on public.dms (sender_id, created_at desc);
create index if not exists dms_recipient_idx on public.dms (recipient_id, created_at desc);

alter table public.dms enable row level security;
grant select, insert, delete on public.dms to authenticated;

drop policy if exists "dms read" on public.dms;
drop policy if exists "dms send" on public.dms;
drop policy if exists "dms delete" on public.dms;
create policy "dms read" on public.dms for select to authenticated
  using (sender_id = auth.uid() or recipient_id = auth.uid());
create policy "dms send" on public.dms for insert to authenticated
  with check (sender_id = auth.uid()
    and sender_name = (select username from public.profiles where id = auth.uid())
    and recipient_name = (select username from public.profiles where id = recipient_id));
create policy "dms delete" on public.dms for delete to authenticated
  using (sender_id = auth.uid());
