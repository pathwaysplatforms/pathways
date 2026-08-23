-- ─────────────────────────────────────────────────────────────────────────────
-- Security hardening: least-privilege API grants (audit Finding 3, High).
--
-- The prior migration granted `all` on every public table to `anon` and
-- `authenticated`, making RLS the sole control and leaving write privileges on
-- the unauthenticated `anon` role. The app performs NO writes as `anon` (all
-- guest/public mutations go through the service-role admin client; signup goes
-- through GoTrue in the auth schema), so `anon` needs SELECT only. We also strip
-- TRUNCATE from `authenticated` — a whole-table operation that bypasses RLS and
-- is never reachable through the Data API anyway.
--
-- Pure DDL — no row data is touched. Safe with `supabase migration up`; do NOT
-- use `supabase db reset`.
-- ─────────────────────────────────────────────────────────────────────────────

begin;

-- anon becomes read-only on the public schema.
revoke insert, update, delete, truncate on all tables in schema public from anon;

-- authenticated keeps row-level DML (RLS gates the rows) but loses TRUNCATE.
revoke truncate on all tables in schema public from authenticated;

-- Apply the same posture to tables created by future migrations (role postgres).
alter default privileges for role postgres in schema public
  revoke insert, update, delete, truncate on tables from anon;
alter default privileges for role postgres in schema public
  revoke truncate on tables from authenticated;

commit;
