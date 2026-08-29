-- ─────────────────────────────────────────────────────────────────────────────
-- Security fix: the two Critical authorization findings from the auth audit.
--
--   Finding 1 — profiles self-escalation of is_admin / subscription_status
--   Finding 2 — posts admin policy keyed on user-editable JWT metadata
--
-- Pure DDL — this migration changes only a trigger and one RLS policy. It reads,
-- writes, and deletes NO row data, and is safe to apply against a populated
-- database with `supabase migration up` (do NOT use `supabase db reset`, which
-- replays from an empty schema and would drop existing data).
--
-- The least-privilege grant tightening (Finding 3) ships separately in
-- 20260708000002_least_privilege_api_grants.sql.
-- ─────────────────────────────────────────────────────────────────────────────

begin;

-- ═══════════════════════════════════════════════════════════════════════════
-- Finding 1 (Critical) — The `profiles` self-update RLS policy places no column
-- restriction, so any authenticated user could set their own `is_admin = true`
-- (full admin takeover) or `subscription_status = 'paid'` (billing bypass) via
-- a direct Data API PATCH.
--
-- `is_admin` and `subscription_status` are legitimately written ONLY by the
-- service-role admin client (account/adminService). A BEFORE UPDATE trigger
-- freezes those two columns against the API roles (anon/authenticated) while
-- letting service_role and postgres through. This is independent of the RLS
-- policy and of the (long) set of user-editable columns, so ordinary profile
-- edits continue to work unchanged.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.enforce_protected_profile_columns()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  new_j jsonb := to_jsonb(new);
  old_j jsonb := to_jsonb(old);
begin
  -- current_user is the role PostgREST SET ROLE'd into for this request:
  -- 'anon' or 'authenticated' for Data API callers, 'service_role' for the
  -- admin client, 'postgres' for migrations. Only the API roles are gated.
  --
  -- Columns are read through to_jsonb so a column that does not (yet) exist on
  -- a given database is simply skipped rather than raising — this keeps one
  -- trigger definition correct across schema drift (e.g. environments where
  -- subscription_status has not been added yet).
  if current_user in ('anon', 'authenticated') then
    if (new_j ? 'is_admin')
       and (new_j ->> 'is_admin') is distinct from (old_j ->> 'is_admin') then
      raise exception 'Not authorized to modify profiles.is_admin'
        using errcode = '42501';
    end if;
    if (new_j ? 'subscription_status')
       and (new_j ->> 'subscription_status') is distinct from (old_j ->> 'subscription_status') then
      raise exception 'Not authorized to modify profiles.subscription_status'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

comment on function public.enforce_protected_profile_columns() is
  'Blocks Data API roles (anon/authenticated) from changing privilege/billing '
  'columns on profiles; service_role and postgres are unaffected.';

drop trigger if exists enforce_protected_profile_columns on public.profiles;

create trigger enforce_protected_profile_columns
  before update on public.profiles
  for each row
  execute function public.enforce_protected_profile_columns();

-- ═══════════════════════════════════════════════════════════════════════════
-- Finding 2 (Critical) — The `posts` admin policy authorized on user-editable
-- JWT metadata (`auth.jwt() -> 'user_metadata' ->> 'role'`). Any user could
-- call supabase.auth.updateUser({ data: { role: 'admin' } }) and gain full
-- write access to posts.
--
-- Re-key the policy to the server-controlled `profiles.is_admin` flag (the same
-- source of truth used by requireAdmin()). Add an explicit TO clause and a
-- WITH CHECK so inserts/updates are held to the same test as reads.
-- ═══════════════════════════════════════════════════════════════════════════

drop policy if exists "Admins have full access" on public.posts;

create policy "Admins have full access"
  on public.posts
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.auth_user_id = (select auth.uid())
        and p.is_admin = true
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.auth_user_id = (select auth.uid())
        and p.is_admin = true
    )
  );

commit;
