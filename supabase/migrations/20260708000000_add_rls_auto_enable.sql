-- ─────────────────────────────────────────────────────────────────────────────
-- Backfill public.rls_auto_enable().
--
-- 20260708000004_harden_security_definer_functions.sql revokes EXECUTE on this
-- function, but no migration ever created it, so `supabase db reset` aborted at
-- that statement with 42883 (function does not exist). The function is real on
-- remote — it predates the tracked migration chain and was never captured — so
-- this migration re-declares it ahead of the revoke.
--
-- The body below is the verbatim output of pg_get_functiondef() against remote.
-- `create or replace` with an identical definition is a semantic no-op there.
--
-- NOTE: this is an EVENT TRIGGER function (returns event_trigger), not a row
-- trigger. It only does work when an event trigger is attached to it. This
-- migration deliberately creates the function ONLY. Creating the event trigger
-- itself requires superuser and is not something the migration chain should do
-- unilaterally — see the divergence note raised with this change.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$
