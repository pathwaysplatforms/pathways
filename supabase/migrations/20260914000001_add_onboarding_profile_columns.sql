-- Promote four onboarding keys from voice_session_data JSONB to real columns.
-- The onboarding Zod schema accepts them, but no column existed, so they could
-- only live in JSONB. Guest signup failed when it tried to write them as columns.

alter table public.profiles
  add column if not exists destination_country      text,
  add column if not exists purpose                  text,
  add column if not exists dependents               integer
    check (dependents >= 0),
  add column if not exists has_prior_canadian_study boolean;

-- Backfill from the JSONB copy so existing users keep their answers.
update public.profiles
set
  destination_country      = coalesce(destination_country, voice_session_data ->> 'destination_country'),
  purpose                  = coalesce(purpose, voice_session_data ->> 'purpose'),
  dependents               = coalesce(dependents, (voice_session_data ->> 'dependents')::integer),
  has_prior_canadian_study = coalesce(has_prior_canadian_study, (voice_session_data ->> 'has_prior_canadian_study')::boolean)
where voice_session_data ?| array['destination_country', 'purpose', 'dependents', 'has_prior_canadian_study'];
