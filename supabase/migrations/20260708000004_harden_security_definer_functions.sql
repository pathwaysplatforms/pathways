-- ─────────────────────────────────────────────────────────────────────────────
-- Harden SECURITY DEFINER functions against RPC exposure.
--
-- Postgres grants EXECUTE to PUBLIC by default, so every SECURITY DEFINER
-- function in the public schema is also callable by anon/authenticated as a
-- PostgREST RPC endpoint (/rest/v1/rpc/<fn>). These are all trigger/utility
-- functions that should only run as triggers or via service_role. Revoking
-- EXECUTE from the API roles closes the RPC surface without affecting trigger
-- firing (which does not require the EXECUTE privilege).
-- ─────────────────────────────────────────────────────────────────────────────

revoke execute on function public.handle_new_user()               from public, anon, authenticated;
revoke execute on function public.log_application_status_change()  from public, anon, authenticated;
revoke execute on function public.log_document_status_change()     from public, anon, authenticated;
revoke execute on function public.rls_auto_enable()                from public, anon, authenticated;
revoke execute on function public.sync_profile_to_jwt()            from public, anon, authenticated;
