-- Run ONCE in Supabase: SQL Editor > + New query > paste ALL > Run. (After supabase-setup-10.sql.)
-- Adds "Seen" to Discussions: remembers when a message was read, so the sender can see it.

alter table public.dms add column if not exists read_at timestamptz;

create or replace function public.dm_mark_read(p_other uuid, p_channel text default 'personal')
returns void language sql security definer set search_path = public as $$
  update public.dms set read_at = now()
  where recipient_id = auth.uid() and sender_id = p_other and read_at is null
    and channel = coalesce(p_channel, 'personal');
$$;
revoke all on function public.dm_mark_read(uuid, text) from public, anon;
grant execute on function public.dm_mark_read(uuid, text) to authenticated;

-- every message sent before today counts as already read (so nobody gets a pile of old notifications)
update public.dms set read_at = created_at where read_at is null;

notify pgrst, 'reload schema';
