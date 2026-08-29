-- Explicit API role grants for the public schema.
--
-- Newer Supabase CLI/Postgres images harden the default privileges for
-- tables created by the postgres role (which is what migrations run as):
-- anon / authenticated / service_role receive only TRUNCATE, REFERENCES,
-- TRIGGER, MAINTAIN — no SELECT / INSERT / UPDATE / DELETE. The remote
-- project predates that change, so it works there implicitly, but every
-- fresh replay (supabase start in CI, local db reset) produces a database
-- the API roles cannot read — PostgREST returns 42501 on every table.
--
-- This migration makes the grants the codebase has always assumed explicit.
-- It is idempotent and a no-op where the grants already exist. Row-level
-- security remains enabled and enforced on every table for anon and
-- authenticated; service_role bypasses RLS by design, as on the remote.

grant usage on schema public to anon, authenticated, service_role;

grant all on all tables    in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all routines  in schema public to anon, authenticated, service_role;

-- Future tables created by migrations (role postgres) get the same grants.
alter default privileges for role postgres in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  grant all on sequences to anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  grant all on routines to anon, authenticated, service_role;
