-- Deduplicate 4 stale Canadian pathway pairs.
--
-- Background: An initial seeding used generic slugs (express-entry-cec, express-entry-fsw,
-- pgwp, express-entry-stem). A later scraper-driven batch re-seeded the same pathways
-- under canonical canada-* slugs with richer content. This migration merges unique content
-- from the stale slugs into their canonical counterparts, then deletes the stale rows.
--
-- Canonical slugs (kept):  canada-cec, canada-express-entry-fsw, canada-pgwp, canada-express-entry-stem
-- Stale slugs (deleted):   express-entry-cec, express-entry-fsw, pgwp, express-entry-stem
--
-- FK impact: applications table is empty; no profiles reference stale slugs.
-- Deletion order: pathway_steps first (NOT NULL FK), then document_requirements, then pathways.
-- document_requirements.step_id has ON DELETE SET NULL — step deletes auto-null it.
--
-- Sources for merged content:
--   67-point FSW threshold: canada.ca/en/.../express-entry/eligibility/federal-skilled-workers.html
--   Proof of funds (mandatory): canada.ca/en/.../express-entry/documents/proof-funds.html
--   STEM category NOC eligibility: canada.ca/en/.../rounds-invitations/category-based-selection.html
--   PGWP apply URL: canada.ca/en/.../study-canada/work/after-graduation/apply.html

-- ============================================================
-- PHASE 1A  canada-cec  (57b21155-bba4-4ce0-bccf-38609e7ac34c)
-- Add post-ITA steps (biometrics, medical, COPR) and 4 submission docs.
-- The stale express-entry-cec had these; canada-cec stops at step 8 (submit after ITA).
-- ============================================================

INSERT INTO public.pathway_steps
  (pathway_id, title, description, step_number, estimated_duration, is_optional, resources)
SELECT
  '57b21155-bba4-4ce0-bccf-38609e7ac34c',
  v.title, v.description, v.step_number, v.estimated_duration, false, '[]'::jsonb
FROM (VALUES
  (9,  'Complete biometrics',
       'Provide fingerprints and photo at a Visa Application Centre (VAC) or Application Support Center. Required for all Express Entry applicants. Biometrics are valid for 10 years.',
       '1–2 weeks'),
  (10, 'Complete medical exam',
       'Attend a medical examination with an IRCC-designated panel physician. Required after submitting your e-APR. Results are valid for 12 months.',
       '1–2 weeks'),
  (11, 'Receive Confirmation of Permanent Residence',
       'IRCC issues your Confirmation of Permanent Residence (COPR). Sign and submit it, then land in Canada before the expiry date to activate your permanent residency.',
       '1–3 months')
) AS v(step_number, title, description, estimated_duration)
WHERE NOT EXISTS (
  SELECT 1 FROM public.pathway_steps
  WHERE pathway_id = '57b21155-bba4-4ce0-bccf-38609e7ac34c'
    AND step_number = v.step_number
);

INSERT INTO public.document_requirements
  (pathway_id, name, description, document_type, is_mandatory, validity_period, validation_rules, sort_order)
SELECT
  '57b21155-bba4-4ce0-bccf-38609e7ac34c',
  v.name, v.description, v.document_type, true, v.validity_period, null, v.sort_order
FROM (VALUES
  ('Valid passport',
   'Current, valid passport or travel document showing your identity and nationality.',
   'passport', null::text, 10),
  ('Police certificates',
   'Police certificates from each country where you have lived for 6 months or more since age 18.',
   'police_certificate', null::text, 11),
  ('Medical exam results',
   'Results of a medical examination conducted by an IRCC-designated panel physician.',
   'medical_exam', '12 months', 12),
  ('Digital photo',
   'Recent digital photograph meeting IRCC specifications.',
   'photo', null::text, 13)
) AS v(name, description, document_type, validity_period, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM public.document_requirements
  WHERE pathway_id = '57b21155-bba4-4ce0-bccf-38609e7ac34c'
    AND document_type = v.document_type
);

-- ============================================================
-- PHASE 1B  canada-express-entry-fsw  (7214d890-a0c9-44d7-901d-b363e7fdd323)
-- Merge existing step 5 ("Calculate your selection factor points") with the
-- 67-point threshold check into a single step at position 5 — no step shifting
-- needed. Add post-ITA steps at 9-12 (e-APR, biometrics, medical, COPR).
-- Fix proof-of-funds from optional to mandatory.
-- Source for mandatory status: canada.ca/en/.../express-entry/documents/proof-funds.html
-- (funds required unless applicant has authorized Canadian work AND a valid job offer).
-- Source for 67-point threshold: canada.ca/en/.../express-entry/who-can-apply/federal-skilled-workers.html
-- ============================================================

UPDATE public.pathway_steps
SET
  title       = 'Score your selection factors and verify the 67-point minimum',
  description = 'Using the federal skilled worker points grid, calculate your score across the six selection factors: official language ability, age, education, work experience, arranged employment in Canada, and adaptability. You must reach at least 67 out of 100 to be eligible for the FSW program — falling below this threshold makes you ineligible regardless of your CRS score in the Express Entry pool.',
  resources   = '[{"label": "IRCC — Federal Skilled Worker eligibility and points grid", "url": "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/who-can-apply/federal-skilled-workers.html", "type": "official"}]'::jsonb
WHERE pathway_id = '7214d890-a0c9-44d7-901d-b363e7fdd323'
  AND step_number = 5
  AND title = 'Calculate your selection factor points';

INSERT INTO public.pathway_steps
  (pathway_id, title, description, step_number, estimated_duration, is_optional, resources)
SELECT
  '7214d890-a0c9-44d7-901d-b363e7fdd323',
  v.title, v.description, v.step_number, v.estimated_duration, false, '[]'::jsonb
FROM (VALUES
  (9,  'Submit e-APR within 60 days',
       'Upload all required documents through the IRCC portal: passport, language results, ECA, reference letters, police certificates, proof of funds, and photos. You have exactly 60 days from your ITA to submit a complete application.',
       '2–4 weeks'),
  (10, 'Complete biometrics',
       'Provide fingerprints and photo at a Visa Application Centre (VAC) or Application Support Center. Biometrics are valid for 10 years.',
       '1–2 weeks'),
  (11, 'Complete medical exam',
       'Attend a medical examination with an IRCC-designated panel physician. Required after submitting your e-APR. Results are valid for 12 months.',
       '1–2 weeks'),
  (12, 'Receive Confirmation of Permanent Residence',
       'IRCC issues your COPR. Sign and submit it, then land in Canada before the expiry date.',
       '1–6 months')
) AS v(step_number, title, description, estimated_duration)
WHERE NOT EXISTS (
  SELECT 1 FROM public.pathway_steps
  WHERE pathway_id = '7214d890-a0c9-44d7-901d-b363e7fdd323'
    AND step_number = v.step_number
);

INSERT INTO public.document_requirements
  (pathway_id, name, description, document_type, is_mandatory, validity_period, validation_rules, sort_order)
SELECT
  '7214d890-a0c9-44d7-901d-b363e7fdd323',
  v.name, v.description, v.document_type, true, v.validity_period, null, v.sort_order
FROM (VALUES
  ('Valid passport',
   'Current, valid passport or travel document.',
   'passport', null::text, 10),
  ('Police certificates',
   'Police certificates from each country where you have lived for 6 months or more since age 18.',
   'police_certificate', null::text, 11),
  ('Medical exam results',
   'Results of a medical examination conducted by an IRCC-designated panel physician.',
   'medical_exam', '12 months', 12),
  ('Digital photo',
   'Recent digital photograph meeting IRCC specifications.',
   'photo', null::text, 13)
) AS v(name, description, document_type, validity_period, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM public.document_requirements
  WHERE pathway_id = '7214d890-a0c9-44d7-901d-b363e7fdd323'
    AND document_type = v.document_type
);

UPDATE public.document_requirements
SET is_mandatory = true
WHERE pathway_id = '7214d890-a0c9-44d7-901d-b363e7fdd323'
  AND name = 'Proof of funds'
  AND is_mandatory = false;

-- ============================================================
-- PHASE 1C  canada-pgwp  (9b5a7066-3fbc-4496-98e0-efbc4f42ac4d)
-- Preserve the IRCC PGWP apply URL from stale pgwp step 2 (only unique content).
-- Appended to step 5 ("Apply for PGWP within 180 days of completion").
-- ============================================================

UPDATE public.pathway_steps
SET resources = resources || '[{"label": "IRCC — Apply for PGWP online", "url": "https://www.canada.ca/en/immigration-refugees-citizenship/services/study-canada/work/after-graduation/apply.html", "type": "official"}]'::jsonb
WHERE pathway_id = '9b5a7066-3fbc-4496-98e0-efbc4f42ac4d'
  AND step_number = 5
  AND NOT (resources::text LIKE '%after-graduation/apply.html%');

-- ============================================================
-- PHASE 1D  canada-express-entry-stem  (ae71faae-7067-4f90-ab63-f32aa3b11879)
-- Add "Confirm NOC is STEM-eligible" as step 2: unique, STEM-specific content absent from
-- canonical. Shift existing steps 2-8 to 3-9. Guarded by DO block for idempotency.
-- Add passport doc (missing) and STEM occupation evidence doc.
-- Source: canada.ca/en/.../rounds-invitations/category-based-selection.html
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.pathway_steps
    WHERE pathway_id = 'ae71faae-7067-4f90-ab63-f32aa3b11879'
      AND title = 'Confirm your NOC code is STEM-eligible'
  ) THEN
    UPDATE public.pathway_steps
    SET step_number = step_number + 1
    WHERE pathway_id = 'ae71faae-7067-4f90-ab63-f32aa3b11879'
      AND step_number >= 2;

    INSERT INTO public.pathway_steps
      (pathway_id, title, description, step_number, estimated_duration, is_optional, resources)
    VALUES (
      'ae71faae-7067-4f90-ab63-f32aa3b11879',
      'Confirm your NOC code is STEM-eligible',
      'Check that your primary work experience NOC code falls within a qualifying STEM category (typically engineering, information technology, natural sciences, or mathematics). IRCC publishes the list of STEM-eligible NOC codes for category-based selection draws — confirm your code before building your Express Entry profile.',
      2, '1–2 days', false,
      '[{"label": "IRCC — STEM-eligible occupations for category-based selection", "url": "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/submit-profile/rounds-invitations/category-based-selection.html", "type": "official"}]'::jsonb
    );
  END IF;
END $$;

INSERT INTO public.document_requirements
  (pathway_id, name, description, document_type, is_mandatory, validity_period, validation_rules, sort_order)
SELECT
  'ae71faae-7067-4f90-ab63-f32aa3b11879',
  v.name, v.description, v.document_type, true, null, null, v.sort_order
FROM (VALUES
  ('Valid passport',
   'Current, valid passport or travel document.',
   'passport', 10),
  ('STEM occupation evidence',
   'Documentation confirming your work experience in a qualifying STEM occupation: reference letters, employment contracts, or job descriptions clearly showing your NOC code and specific duties.',
   'employment_reference', 11)
) AS v(name, description, document_type, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM public.document_requirements
  WHERE pathway_id = 'ae71faae-7067-4f90-ab63-f32aa3b11879'
    AND document_type = v.document_type
    AND name = v.name
);

-- ============================================================
-- PHASE 2  Delete stale pathway rows
-- ============================================================

-- express-entry-cec  (5c36144f-aea3-47ea-a610-e3133a528aad)
DELETE FROM public.pathway_steps          WHERE pathway_id = '5c36144f-aea3-47ea-a610-e3133a528aad';
DELETE FROM public.document_requirements   WHERE pathway_id = '5c36144f-aea3-47ea-a610-e3133a528aad';
DELETE FROM public.pathways                WHERE id          = '5c36144f-aea3-47ea-a610-e3133a528aad';

-- express-entry-fsw  (635c4528-ad6e-40c3-95d9-6794d805a98b)
DELETE FROM public.pathway_steps          WHERE pathway_id = '635c4528-ad6e-40c3-95d9-6794d805a98b';
DELETE FROM public.document_requirements   WHERE pathway_id = '635c4528-ad6e-40c3-95d9-6794d805a98b';
DELETE FROM public.pathways                WHERE id          = '635c4528-ad6e-40c3-95d9-6794d805a98b';

-- pgwp  (4d3ab0e9-7688-4eb9-b308-601f162cedf6)  — 0 document_requirements rows
DELETE FROM public.pathway_steps          WHERE pathway_id = '4d3ab0e9-7688-4eb9-b308-601f162cedf6';
DELETE FROM public.pathways                WHERE id          = '4d3ab0e9-7688-4eb9-b308-601f162cedf6';

-- express-entry-stem  (1eba0806-b290-4030-baa5-ffde6748452b)
DELETE FROM public.pathway_steps          WHERE pathway_id = '1eba0806-b290-4030-baa5-ffde6748452b';
DELETE FROM public.document_requirements   WHERE pathway_id = '1eba0806-b290-4030-baa5-ffde6748452b';
DELETE FROM public.pathways                WHERE id          = '1eba0806-b290-4030-baa5-ffde6748452b';
