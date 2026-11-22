-- Run ONCE in Supabase: SQL Editor > New query > paste > Run. (After the other setup files.)
-- Value Voting: polls asking for a price / demand / stars change, votes, and comments.
-- Everyone can READ. Only logged-in people can post, vote and comment.

create table if not exists public.polls(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  username text not null,
  item text not null check (char_length(item) between 1 and 80),
  kind text not null check (kind in ('price','demand','stars')),
  current_val text not null default '' check (char_length(current_val) <= 40),
  proposed text not null check (char_length(proposed) between 1 and 40),
  note text not null default '' check (char_length(note) <= 500),
  status text not null default 'open' check (status in ('open','closed')),
  created_at timestamptz not null default now()
);
create index if not exists polls_created_idx on public.polls (created_at desc);

create table if not exists public.poll_votes(
  poll_id uuid not null references public.polls(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  vote text not null check (vote in ('agree','disagree')),
  created_at timestamptz not null default now(),
  primary key (poll_id, user_id)
);

create table if not exists public.poll_comments(
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  username text not null,
  text text not null check (char_length(text) between 1 and 300),
  created_at timestamptz not null default now()
);
create index if not exists poll_comments_idx on public.poll_comments (poll_id, created_at);

alter table public.polls enable row level security;
alter table public.poll_votes enable row level security;
alter table public.poll_comments enable row level security;
grant select on public.polls, public.poll_votes, public.poll_comments to anon, authenticated;
grant insert, delete on public.polls, public.poll_comments to authenticated;
grant update (status) on public.polls to authenticated;
grant insert, update, delete on public.poll_votes to authenticated;

drop policy if exists "polls read" on public.polls;
drop policy if exists "polls post" on public.polls;
drop policy if exists "polls delete" on public.polls;
drop policy if exists "polls close" on public.polls;
create policy "polls read" on public.polls for select to anon, authenticated using (true);
create policy "polls post" on public.polls for insert to authenticated
  with check (user_id = auth.uid() and username = (select username from public.profiles where id = auth.uid()));
create policy "polls delete" on public.polls for delete to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "polls close" on public.polls for update to authenticated using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "votes read" on public.poll_votes;
drop policy if exists "votes insert" on public.poll_votes;
drop policy if exists "votes update" on public.poll_votes;
drop policy if exists "votes delete" on public.poll_votes;
create policy "votes read" on public.poll_votes for select to anon, authenticated using (true);
create policy "votes insert" on public.poll_votes for insert to authenticated
  with check (user_id = auth.uid() and exists(select 1 from public.polls p where p.id = poll_id and p.status = 'open'));
create policy "votes update" on public.poll_votes for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and exists(select 1 from public.polls p where p.id = poll_id and p.status = 'open'));
create policy "votes delete" on public.poll_votes for delete to authenticated using (user_id = auth.uid());

drop policy if exists "pc read" on public.poll_comments;
drop policy if exists "pc post" on public.poll_comments;
drop policy if exists "pc delete" on public.poll_comments;
create policy "pc read" on public.poll_comments for select to anon, authenticated using (true);
create policy "pc post" on public.poll_comments for insert to authenticated
  with check (user_id = auth.uid() and username = (select username from public.profiles where id = auth.uid()));
create policy "pc delete" on public.poll_comments for delete to authenticated using (user_id = auth.uid() or public.is_admin());
