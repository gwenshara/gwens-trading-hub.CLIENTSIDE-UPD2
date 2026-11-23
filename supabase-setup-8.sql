-- Run ONCE in Supabase: SQL Editor > New query > paste > Run. (After the other setup files.)
-- 1) Friends (requests + accept), 2) Follow, 3) pictures and items in Discussions.

-- 1) Friends
create table if not exists public.friendships(
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  addressee_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted')),
  created_at timestamptz not null default now(),
  check (requester_id <> addressee_id)
);
create unique index if not exists friendships_pair_uq
  on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
alter table public.friendships enable row level security;
grant select, insert, delete on public.friendships to authenticated;
revoke update on public.friendships from authenticated;
grant update (status) on public.friendships to authenticated;
drop policy if exists "fr read" on public.friendships;
drop policy if exists "fr send" on public.friendships;
drop policy if exists "fr accept" on public.friendships;
drop policy if exists "fr delete" on public.friendships;
create policy "fr read" on public.friendships for select to authenticated
  using (requester_id = auth.uid() or addressee_id = auth.uid());
create policy "fr send" on public.friendships for insert to authenticated
  with check (requester_id = auth.uid() and status = 'pending');
create policy "fr accept" on public.friendships for update to authenticated
  using (addressee_id = auth.uid() and status = 'pending')
  with check (addressee_id = auth.uid() and status = 'accepted');
create policy "fr delete" on public.friendships for delete to authenticated
  using (requester_id = auth.uid() or addressee_id = auth.uid());

-- 2) Follow
create table if not exists public.follows(
  follower_id uuid not null references auth.users(id) on delete cascade,
  followee_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);
alter table public.follows enable row level security;
grant select, insert, delete on public.follows to authenticated;
drop policy if exists "follows read" on public.follows;
drop policy if exists "follows add" on public.follows;
drop policy if exists "follows remove" on public.follows;
create policy "follows read" on public.follows for select to authenticated using (true);
create policy "follows add" on public.follows for insert to authenticated with check (follower_id = auth.uid());
create policy "follows remove" on public.follows for delete to authenticated using (follower_id = auth.uid());

-- Counts anyone can see on a profile (friends, followers, following)
create or replace function public.social_counts(target uuid) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'friends',   (select count(*) from public.friendships where status = 'accepted' and (requester_id = target or addressee_id = target)),
    'followers', (select count(*) from public.follows where followee_id = target),
    'following', (select count(*) from public.follows where follower_id = target))
$$;
revoke all on function public.social_counts(uuid) from public, anon;
grant execute on function public.social_counts(uuid) to authenticated;

-- 3) Pictures and items inside Discussions
alter table public.dms add column if not exists kind text not null default 'text';
alter table public.dms add column if not exists payload jsonb;
do $$ declare c record; begin
  for c in select conname from pg_constraint
    where conrelid = 'public.dms'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%char_length(text)%' and conname <> 'dms_content_check'
  loop execute format('alter table public.dms drop constraint %I', c.conname); end loop;
end $$;
alter table public.dms drop constraint if exists dms_content_check;
alter table public.dms add constraint dms_content_check check (
  char_length(text) <= 1000 and (
    (kind = 'text'  and payload is null and char_length(text) >= 1)
    or (kind = 'item'  and jsonb_typeof(payload) = 'object' and char_length(coalesce(payload->>'n','')) between 1 and 80)
    or (kind = 'image' and jsonb_typeof(payload) = 'object' and char_length(coalesce(payload->>'img','')) between 20 and 450000)
  )
);
