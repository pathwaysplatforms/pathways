-- Add second wave of IRCC-sourced enrichment columns to pathway_steps.
--
-- All columns are nullable — existing rows are unaffected.
-- RLS: the existing authenticated-read policy on pathway_steps covers these
-- columns automatically. The service_role bypasses RLS and can write freely
-- (no additional policy required).
--
-- Populated by: scrapers/enrichers/pathway_steps_enricher.py

ALTER TABLE public.pathway_steps
  ADD COLUMN IF NOT EXISTS common_mistakes    JSONB,
  ADD COLUMN IF NOT EXISTS what_happens_next  TEXT,
  ADD COLUMN IF NOT EXISTS validity_period    TEXT,
  ADD COLUMN IF NOT EXISTS applicant_portal   TEXT;

COMMENT ON COLUMN public.pathway_steps.common_mistakes   IS 'Top 2-3 mistakes applicants make at this step (array of strings)';
COMMENT ON COLUMN public.pathway_steps.what_happens_next IS 'One sentence: what IRCC/the authority does after this step';
COMMENT ON COLUMN public.pathway_steps.validity_period   IS 'How long this step''s output stays valid, e.g. ''ITA valid for 60 days''; null if N/A';
COMMENT ON COLUMN public.pathway_steps.applicant_portal  IS 'Portal URL where this action is completed, e.g. IRCC secure account';

NOTIFY pgrst, 'reload schema';
