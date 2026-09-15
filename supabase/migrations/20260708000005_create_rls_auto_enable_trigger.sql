-- ─────────────────────────────────────────────────────────────────────────────
-- Bind the event trigger that fires public.rls_auto_enable().
--
-- 20260708000000 backfilled the function, but a function returning event_trigger
-- does nothing until an EVENT TRIGGER is attached to it. Remote has such a
-- trigger; the migration chain never declared one, so a fresh `db reset` produced
-- a database where new tables do NOT get row-level security enabled automatically
-- while remote does. This migration closes that divergence.
--
-- Placement: every table created earlier in the chain already enables RLS
-- explicitly (verified: zero tables in `public` with relrowsecurity = false), so
-- attaching the trigger here rather than at the head of the chain is equivalent
-- for the current schema and correct for every table added from here on.
--
-- Postgres has no CREATE EVENT TRIGGER IF NOT EXISTS, hence the guarded DO block.
-- That also makes this a no-op on any database that already has the trigger.
--
-- The function filters command tags internally; the WHEN TAG clause below simply
-- avoids waking it for unrelated DDL.
-- ─────────────────────────────────────────────────────────────────────────────

do $$
begin
  if not exists (
    select 1
    from pg_event_trigger e
    join pg_proc p on p.oid = e.evtfoid
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'rls_auto_enable'
  ) then
    create event trigger rls_auto_enable
      on ddl_command_end
      when tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      execute function public.rls_auto_enable();
  end if;
end
$$;
