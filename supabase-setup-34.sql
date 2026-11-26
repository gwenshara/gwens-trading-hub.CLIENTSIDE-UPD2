-- Run ONCE in Supabase: SQL Editor > + New query > paste ALL > Run. (After supabase-setup-33.sql.)
-- Adds: 1) a staff list of every account with the IP it was made from (admins + moderators only)
--       2) banning several accounts at once
--       3) banned accounts no longer use up the 3 slots of their IP (banning frees the slots)
-- Safe to run again.

-- ---------- slots: banned accounts don't count ----------
create or replace function public.can_signup() returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_ip text := public.norm_ip(public.req_ip());
begin
  if v_ip is null then return jsonb_build_object('ok', true); end if;
  if exists(select 1 from public.ip_bans where ip = v_ip) then return jsonb_build_object('ok', false); end if;
  if (select count(*) from public.signup_ips s
        where s.ip = v_ip and not exists(select 1 from public.user_bans b where b.user_id = s.user_id)) >= 3 then
    return jsonb_build_object('ok', false); end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.claim_signup_ip() returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_raw text := public.req_ip(); v_ip text := public.norm_ip(public.req_ip()); v_mine timestamptz; n int; v_name text;
begin
  if auth.uid() is null or v_ip is null then return jsonb_build_object('ok', true); end if;
  insert into public.signup_ips(user_id, ip) values (auth.uid(), v_ip) on conflict (user_id) do nothing;
  insert into public.user_ips(user_id, ip) values (auth.uid(), v_raw)
    on conflict (user_id) do update set ip = excluded.ip, seen_at = now();
  if public.is_admin() then return jsonb_build_object('ok', true); end if;
  select created_at into v_mine from public.signup_ips where user_id = auth.uid();
  select count(*) into n from public.signup_ips s
    where s.ip = v_ip
      and not exists(select 1 from public.user_bans b where b.user_id = s.user_id)
      and (s.created_at < v_mine or (s.created_at = v_mine and s.user_id <= auth.uid()));
  if n > 3 then
    select username into v_name from public.profiles where id = auth.uid();
    insert into public.user_bans(user_id, username, reason, banned_by)
      values (auth.uid(), coalesce(v_name, ''), 'More than 3 accounts on one IP address.', 'system')
      on conflict (user_id) do nothing;
    delete from public.push_subs where user_id = auth.uid();
    return jsonb_build_object('ok', false, 'banned', true);
  end if;
  return jsonb_build_object('ok', true);
end $$;

-- ---------- every account + where it was made (admins and moderators only) ----------
-- moderators don't see the IP of admins / other moderators (same rule as banning)
create or replace function public.staff_accounts() returns jsonb
language plpgsql security definer set search_path = public as $$
declare adm boolean := public.is_admin();
begin
  if not public.is_mod() then raise exception 'Only admins and moderators can do this.'; end if;
  return coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at) from (
    select p.id::text as id, p.username, p.role, coalesce(p.roles, '{}') as roles, p.created_at,
      case when (p.role = 'admin' or 'moderator' = any(coalesce(p.roles, '{}'))) and not adm and p.id <> auth.uid()
           then null else s.ip end as signup_ip,
      case when (p.role = 'admin' or 'moderator' = any(coalesce(p.roles, '{}'))) and not adm and p.id <> auth.uid()
           then null else u.ip end as last_ip,
      u.seen_at,
      exists(select 1 from public.user_bans b where b.user_id = p.id) as banned
    from public.profiles p
    left join public.signup_ips s on s.user_id = p.id
    left join public.user_ips u on u.user_id = p.id
  ) x), '[]'::jsonb);
end $$;

-- ---------- ban several accounts at once (account bans only: the IP is NOT banned, so the slots are free again) ----------
create or replace function public.ban_many(targets text[], reason text default '') returns jsonb
language plpgsql security definer set search_path = public as $$
declare t public.profiles%rowtype; me text; nm text; n int := 0; skipped int := 0; why text := left(coalesce(reason, ''), 200);
begin
  if not public.is_mod() then raise exception 'Only admins and moderators can do this.'; end if;
  if coalesce(array_length(targets, 1), 0) > 200 then raise exception 'Select at most 200 accounts at a time.'; end if;
  select username into me from public.profiles where id = auth.uid();
  foreach nm in array coalesce(targets, '{}') loop
    select * into t from public.profiles where lower(username) = lower(nm);
    if not found or t.id = auth.uid() or t.role = 'admin'
       or ('moderator' = any(coalesce(t.roles, '{}')) and not public.is_admin()) then
      skipped := skipped + 1; continue;
    end if;
    insert into public.user_bans(user_id, username, reason, banned_by) values (t.id, t.username, why, me)
      on conflict (user_id) do update set reason = excluded.reason, banned_by = excluded.banned_by, created_at = now();
    delete from public.push_subs where user_id = t.id;
    n := n + 1;
  end loop;
  return jsonb_build_object('banned', n, 'skipped', skipped);
end $$;

-- ---------- permissions ----------
revoke all on function public.staff_accounts() from public, anon;
revoke all on function public.ban_many(text[], text) from public, anon;
grant execute on function public.staff_accounts() to authenticated;
grant execute on function public.ban_many(text[], text) to authenticated;

select 'Staff account list, bulk ban and freed slots are ready.' as result;
