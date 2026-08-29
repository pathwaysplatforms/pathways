-- Pre-pathway flow redesign: adds Canadian immigration pathway-determining fields
-- Uses IF NOT EXISTS / DO $$ guards throughout so the migration is safe to re-run.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS date_of_birth             DATE,
  ADD COLUMN IF NOT EXISTS income_currency           TEXT DEFAULT 'CAD',
  ADD COLUMN IF NOT EXISTS intended_province         TEXT,
  ADD COLUMN IF NOT EXISTS has_canadian_experience   BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS language_proficiency_self TEXT
    CHECK (language_proficiency_self IN ('native','fluent','advanced','intermediate','basic')),
  ADD COLUMN IF NOT EXISTS has_family_in_canada      BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS education_level_voice     TEXT,
  ADD COLUMN IF NOT EXISTS spouse_coming_to_canada   BOOLEAN DEFAULT FALSE,

  -- Pathway engine interface — stores the structured JSON handed off to the matching engine
  ADD COLUMN IF NOT EXISTS pathway_input_json        JSONB,

  -- Onboarding resume tracking (more granular than onboarding_status)
  ADD COLUMN IF NOT EXISTS onboarding_step           TEXT DEFAULT 'not_started'
    CHECK (onboarding_step IN (
      'not_started','voice_in_progress','voice_complete','review','complete'
    )),

  -- Collection method chosen by the user
  ADD COLUMN IF NOT EXISTS onboarding_method         TEXT
    CHECK (onboarding_method IN ('voice','chat','form'));

-- Rename the GBP-specific salary column to a currency-agnostic name.
-- Only executed if annual_salary_gbp still exists (idempotent guard).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'annual_salary_gbp'
  ) THEN
    ALTER TABLE public.profiles RENAME COLUMN annual_salary_gbp TO annual_income;
  END IF;
END $$;

-- Add annual_income if neither annual_salary_gbp nor annual_income exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'annual_income'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN annual_income INTEGER;
  END IF;
END $$;
