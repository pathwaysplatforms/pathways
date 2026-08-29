-- Feature: pathway_steps.resources column + Express Entry / PNP / PGWP pathway seed.
-- Resources are {label, url, type} objects displayed in the step detail drawer.
-- Uses ON CONFLICT / conditional inserts for idempotency.

ALTER TABLE pathway_steps
  ADD COLUMN IF NOT EXISTS resources JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN pathway_steps.resources IS
  'Array of {label, url, type} objects. type: official | form | external';

-- ── Permanent-residency category ──────────────────────────────────────────────
INSERT INTO public.pathway_categories (name, slug, description)
  VALUES ('Permanent Residency', 'permanent-residency', 'Permanent residency pathways for skilled workers and their families')
  ON CONFLICT (slug) DO NOTHING;

-- ── Express Entry pathway ──────────────────────────────────────────────────────
WITH
  ca  AS (SELECT id FROM public.countries WHERE iso_code = 'CA'),
  cat AS (SELECT id FROM public.pathway_categories WHERE slug = 'permanent-residency')
INSERT INTO public.pathways (
  country_id, category_id, title, slug, official_name, description,
  processing_time_min, processing_time_max, fee_gbp,
  requires_degree, min_years_experience,
  requires_english_test, english_min_score,
  additional_rules, is_active
)
SELECT
  ca.id, cat.id,
  'Express Entry',
  'express-entry',
  'Express Entry — Federal Skilled Worker Program',
  'Points-based permanent residency pathway for skilled workers. Candidates are ranked by Comprehensive Ranking System (CRS) score and invited through regular draws.',
  '6 months', '12 months', 0,
  true, 1,
  true, 'CLB 7',
  '{"crs_based": true, "pool": "express_entry", "clb_min": {"listening": 7, "reading": 7, "writing": 7, "speaking": 7}, "typical_crs_min": 470}'::jsonb,
  true
FROM ca, cat
ON CONFLICT (slug) DO NOTHING;

-- ── Express Entry pathway steps ────────────────────────────────────────────────
-- Only insert if the pathway has no steps yet (safe for re-runs)
INSERT INTO public.pathway_steps (pathway_id, title, description, step_number, estimated_duration)
SELECT
  p.id,
  steps.title,
  steps.description,
  steps.step_number,
  steps.estimated_duration
FROM (SELECT id FROM public.pathways WHERE slug = 'express-entry') p,
(VALUES
  (1, 'Educational Credential Assessment',
   'Have your foreign educational credentials assessed by a designated organisation such as WES so IRCC can evaluate your Canadian equivalent education level.',
   '4–12 weeks'),
  (2, 'Language Testing',
   'Complete an approved English or French language test (IELTS General Training or CELPIP for English; TEF Canada or TCF Canada for French) and obtain your CLB scores.',
   '4–6 weeks'),
  (3, 'Create Express Entry Profile',
   'Submit your Express Entry profile on the IRCC portal. Your Comprehensive Ranking System (CRS) score is calculated based on your age, education, work experience, and language scores.',
   '1–2 weeks'),
  (4, 'Wait for Invitation to Apply',
   'Your profile sits in the Express Entry pool. IRCC holds regular draws and issues Invitations to Apply (ITAs) to the highest-ranked candidates. Draw scores vary by program and economic conditions.',
   '1–24 months'),
  (5, 'Submit Permanent Residency Application',
   'After receiving your ITA you have 60 days to submit a complete online application for permanent residency. Gather all required documents, undergo medical and security checks, and pay the processing fee.',
   '8–12 months')
) AS steps(step_number, title, description, estimated_duration)
WHERE NOT EXISTS (
  SELECT 1 FROM public.pathway_steps WHERE pathway_id = p.id LIMIT 1
);

-- ── Express Entry step resources ───────────────────────────────────────────────
UPDATE public.pathway_steps
SET resources = '[
  {"label": "WES Canada — Start Assessment", "url": "https://www.wes.org/ca/", "type": "official"},
  {"label": "IRCC — Recognized Credential Authorities", "url": "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/documents/education-assessed/who-can-assess.html", "type": "official"}
]'::jsonb
WHERE pathway_id = (SELECT id FROM public.pathways WHERE slug = 'express-entry')
  AND step_number = 1;

UPDATE public.pathway_steps
SET resources = '[
  {"label": "Book IELTS General Training", "url": "https://ielts.org/book-a-test", "type": "official"},
  {"label": "Book CELPIP General", "url": "https://www.celpip.ca/take-celpip/register/", "type": "official"},
  {"label": "CLB Equivalency Chart", "url": "https://www.canada.ca/en/immigration-refugees-citizenship/corporate/publications-manuals/operational-bulletins-manuals/standard-requirements/language-requirements/test-equivalency-charts.html", "type": "official"}
]'::jsonb
WHERE pathway_id = (SELECT id FROM public.pathways WHERE slug = 'express-entry')
  AND step_number = 2;

UPDATE public.pathway_steps
SET resources = '[
  {"label": "Create your Express Entry profile", "url": "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/apply-permanent-residence/profile.html", "type": "official"},
  {"label": "CRS Score estimator — IRCC", "url": "https://www.canada.ca/en/immigration-refugees-citizenship/services/come-canada-tool-immigration-express-entry.html", "type": "official"}
]'::jsonb
WHERE pathway_id = (SELECT id FROM public.pathways WHERE slug = 'express-entry')
  AND step_number = 3;

UPDATE public.pathway_steps
SET resources = '[
  {"label": "Latest Express Entry draw results", "url": "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/submit-profile/rounds-invitations.html", "type": "official"}
]'::jsonb
WHERE pathway_id = (SELECT id FROM public.pathways WHERE slug = 'express-entry')
  AND step_number = 4;

UPDATE public.pathway_steps
SET resources = '[
  {"label": "IRCC — After receiving your ITA", "url": "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/apply-permanent-residence.html", "type": "official"},
  {"label": "IMM 0008 — Generic Application Form", "url": "https://www.canada.ca/en/immigration-refugees-citizenship/services/application/application-forms-guides/imm0008-application-generic.html", "type": "form"}
]'::jsonb
WHERE pathway_id = (SELECT id FROM public.pathways WHERE slug = 'express-entry')
  AND step_number = 5;

-- ── Provincial Nominee Program ─────────────────────────────────────────────────
WITH
  ca  AS (SELECT id FROM public.countries WHERE iso_code = 'CA'),
  cat AS (SELECT id FROM public.pathway_categories WHERE slug = 'permanent-residency')
INSERT INTO public.pathways (
  country_id, category_id, title, slug, official_name, description,
  processing_time_min, processing_time_max, fee_gbp,
  requires_degree, min_years_experience,
  requires_english_test, english_min_score,
  additional_rules, is_active
)
SELECT
  ca.id, cat.id,
  'Provincial Nominee Program',
  'provincial-nominee',
  'Provincial Nominee Program (PNP)',
  'Province-specific streams that nominate skilled workers, international students, and business investors for permanent residency. Each province sets its own eligibility criteria.',
  '6 months', '18 months', 0,
  false, 0,
  true, 'CLB 4',
  '{"requires_provincial_nomination": true}'::jsonb,
  true
FROM ca, cat
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.pathway_steps (pathway_id, title, description, step_number, estimated_duration)
SELECT
  p.id, steps.title, steps.description, steps.step_number, steps.estimated_duration
FROM (SELECT id FROM public.pathways WHERE slug = 'provincial-nominee') p,
(VALUES
  (1, 'Choose a Province and Stream',
   'Research provincial nomination streams that match your skills, work experience, education level, and intended destination. Each province has unique eligibility criteria and targeted occupations.',
   '2–4 weeks'),
  (2, 'Submit Provincial Application',
   'Apply directly to your chosen provincial government stream. If successful, you receive a Provincial Nomination Certificate (PNC) which significantly boosts your CRS score in Express Entry or allows a paper-based PR application.',
   '3–12 months'),
  (3, 'Apply for Permanent Residency',
   'Use your Provincial Nomination Certificate to apply for Canadian PR, either through Express Entry (enhanced nomination adds 600 CRS points) or the paper-based PNP stream.',
   '6–18 months')
) AS steps(step_number, title, description, estimated_duration)
WHERE NOT EXISTS (
  SELECT 1 FROM public.pathway_steps WHERE pathway_id = p.id LIMIT 1
);

UPDATE public.pathway_steps
SET resources = '[
  {"label": "IRCC — Provincial Nominee Program overview", "url": "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/provincial-nominees.html", "type": "official"},
  {"label": "Compare PNP streams by province", "url": "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/provincial-nominees/province-territory.html", "type": "official"}
]'::jsonb
WHERE pathway_id = (SELECT id FROM public.pathways WHERE slug = 'provincial-nominee')
  AND step_number = 1;

UPDATE public.pathway_steps
SET resources = '[
  {"label": "IRCC — After provincial nomination", "url": "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/provincial-nominees/after-apply-next-steps.html", "type": "official"}
]'::jsonb
WHERE pathway_id = (SELECT id FROM public.pathways WHERE slug = 'provincial-nominee')
  AND step_number = 2;

-- ── Post-Graduation Work Permit ────────────────────────────────────────────────
WITH
  ca  AS (SELECT id FROM public.countries WHERE iso_code = 'CA'),
  cat AS (SELECT id FROM public.pathway_categories WHERE slug = 'skilled-worker')
INSERT INTO public.pathways (
  country_id, category_id, title, slug, official_name, description,
  processing_time_min, processing_time_max, fee_gbp,
  requires_degree, min_years_experience,
  requires_english_test, english_min_score,
  additional_rules, is_active
)
SELECT
  ca.id, cat.id,
  'Post-Graduation Work Permit',
  'pgwp',
  'Post-Graduation Work Permit (PGWP)',
  'Open work permit for international graduates of eligible Canadian designated learning institutions. Valid for up to 3 years — a key bridge to permanent residency via Express Entry or PNP.',
  '2 months', '5 months', 0,
  false, 0,
  false, null,
  '{"requires_canadian_study": true, "open_work_permit": true}'::jsonb,
  true
FROM ca, cat
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.pathway_steps (pathway_id, title, description, step_number, estimated_duration)
SELECT
  p.id, steps.title, steps.description, steps.step_number, steps.estimated_duration
FROM (SELECT id FROM public.pathways WHERE slug = 'pgwp') p,
(VALUES
  (1, 'Graduate from a Designated Learning Institution',
   'Complete your full-time program (minimum 8 months) at an eligible DLI. Your PGWP duration will match your study duration — programs of 2 years or longer qualify for the full 3-year permit.',
   'Program duration'),
  (2, 'Apply for Your PGWP',
   'Submit your PGWP application within 180 days of receiving written confirmation of your final grades. You can apply online through your IRCC account.',
   '2–5 months'),
  (3, 'Work and Build Canadian Experience',
   'Use your open PGWP to work for any Canadian employer in any occupation. Canadian work experience in a TEER 0, 1, 2, or 3 occupation qualifies you for Express Entry programs.',
   'Up to 3 years')
) AS steps(step_number, title, description, estimated_duration)
WHERE NOT EXISTS (
  SELECT 1 FROM public.pathway_steps WHERE pathway_id = p.id LIMIT 1
);

UPDATE public.pathway_steps
SET resources = '[
  {"label": "IRCC — PGWP eligibility requirements", "url": "https://www.canada.ca/en/immigration-refugees-citizenship/services/study-canada/work/after-graduation/about.html", "type": "official"},
  {"label": "Check if your school is a DLI", "url": "https://www.canada.ca/en/immigration-refugees-citizenship/services/study-canada/study-permit/prepare/designated-learning-institutions-list.html", "type": "official"}
]'::jsonb
WHERE pathway_id = (SELECT id FROM public.pathways WHERE slug = 'pgwp')
  AND step_number = 1;

UPDATE public.pathway_steps
SET resources = '[
  {"label": "IRCC — Apply for PGWP online", "url": "https://www.canada.ca/en/immigration-refugees-citizenship/services/study-canada/work/after-graduation/apply.html", "type": "official"}
]'::jsonb
WHERE pathway_id = (SELECT id FROM public.pathways WHERE slug = 'pgwp')
  AND step_number = 2;
