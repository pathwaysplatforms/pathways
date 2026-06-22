-- Normalize 'education_credential_assessment' → 'educational_credential_assessment'.
--
-- One row on canada-express-entry-fsw (id: 706471f4) has the shorter misspelling.
-- The canonical IRCC term is "Educational Credential Assessment". The FSTP pathway
-- already uses the correct form. Aligning FSW to match.
--
-- ⚠️  REMOTE ONLY: the canonical Canadian pathways (canada-cec, canada-express-entry-fsw,
-- etc.) exist only in the remote database — they were seeded externally and are absent
-- from a fresh local `supabase db reset`. This migration safely no-ops locally
-- (the WHERE clause finds no rows). You must push this to remote separately.
-- See the Phase 2 deployment checklist at the bottom of this file.
--
-- Deployment:
--   1. Apply locally first (no-op):  npx supabase db reset
--   2. Login & link to remote:       npx supabase login
--                                    npx supabase link
--   3. Push to remote:               npx supabase db push --linked

UPDATE public.document_requirements
  SET document_type = 'educational_credential_assessment'
  WHERE id = '706471f4-f630-410d-80b0-32ebd717caa6'
    AND document_type = 'education_credential_assessment';
