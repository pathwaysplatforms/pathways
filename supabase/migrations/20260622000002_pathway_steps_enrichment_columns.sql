-- Add IRCC-sourced enrichment columns to pathway_steps.
--
-- All columns are nullable — existing rows are unaffected.
-- RLS: the existing authenticated-read policy on pathway_steps covers these
-- columns automatically. The service_role bypasses RLS and can write freely
-- (no additional policy required).
--
-- Populated by: scrapers/enrichers/pathway_steps_enricher.py

ALTER TABLE public.pathway_steps
  ADD COLUMN IF NOT EXISTS official_url         TEXT,
  ADD COLUMN IF NOT EXISTS form_numbers         TEXT[],
  ADD COLUMN IF NOT EXISTS fee_cad              NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS estimated_days_min   INTEGER,
  ADD COLUMN IF NOT EXISTS estimated_days_max   INTEGER,
  ADD COLUMN IF NOT EXISTS checklist_items      JSONB,
  ADD COLUMN IF NOT EXISTS pro_tips             TEXT,
  ADD COLUMN IF NOT EXISTS last_enriched_at     TIMESTAMPTZ;

COMMENT ON COLUMN public.pathway_steps.official_url       IS 'Direct IRCC page for this step';
COMMENT ON COLUMN public.pathway_steps.form_numbers       IS 'IRCC form numbers required, e.g. ARRAY[''IMM 0008'']';
COMMENT ON COLUMN public.pathway_steps.fee_cad            IS 'Official IRCC fee in CAD; null if free or not applicable';
COMMENT ON COLUMN public.pathway_steps.estimated_days_min IS 'Minimum processing days per IRCC data';
COMMENT ON COLUMN public.pathway_steps.estimated_days_max IS 'Maximum processing days per IRCC data';
COMMENT ON COLUMN public.pathway_steps.checklist_items    IS 'Ordered array of sub-task strings for the user';
COMMENT ON COLUMN public.pathway_steps.pro_tips           IS 'Common gotchas or advice (1–3 sentences)';
COMMENT ON COLUMN public.pathway_steps.last_enriched_at   IS 'Timestamp of last enricher run for this row';

NOTIFY pgrst, 'reload schema';
