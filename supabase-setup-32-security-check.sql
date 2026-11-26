-- READ-ONLY security check. Run in Supabase SQL Editor. It changes nothing.
-- 1) Tables in "public" WITHOUT row level security (should return no rows):
select c.relname as table_without_rls
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='r' and not c.relrowsecurity;

-- 2) Tables with RLS on but NO policies (nobody can read them; fine if intended):
select c.relname as rls_on_no_policy
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='r' and c.relrowsecurity
and not exists (select 1 from pg_policies p where p.schemaname='public' and p.tablename=c.relname);

-- 3) Policies that let anyone (including logged-out visitors) write:
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname='public' and cmd in ('INSERT','UPDATE','DELETE','ALL')
and ('anon' = any(roles) or 'public' = any(roles))
and (coalesce(qual,'true') in ('true','(true)') or coalesce(with_check,'true') in ('true','(true)'));

-- 4) SECURITY DEFINER functions (they bypass RLS, so each must check who is calling):
select p.proname as security_definer_function
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.prosecdef order by 1;
