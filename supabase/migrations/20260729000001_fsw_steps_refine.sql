-- Refine canada-express-entry-fsw steps down to necessary actions only.
--
-- Background: 20260725000001 (delete "Calculate selection factor points") and
-- 20260725000002 (checklist overhaul, written assuming that deletion had already
-- happened) were both committed, but the deletion never actually took effect on
-- this pathway's data — all 8 original steps are still present. Because the
-- overhaul migration's UPDATEs are keyed by step_number, its content landed on
-- the wrong rows: the proof-of-funds tasks were written onto the "Calculate
-- selection factor points" row, and the Express Entry profile submission tasks
-- were written onto the "Gather proof of funds documentation" row. This
-- migration finishes the job directly against the actual current data (matched
-- by title, not step_number, so it is not sensitive to prior drift):
--
--   1. Remove "Calculate selection factor points" — FSW eligibility scoring is
--      computed automatically by the platform's FSW estimator; a manual
--      "calculate it yourself" step is redundant and was already correctly
--      flagged as misleading in 20260725000001.
--   2. Remove "Assemble all required documents" — zero checklist tasks, zero
--      linked document requirements. Documents are already collected per-step
--      via each step's own "Documents needed" checklist card, so a separate
--      compile-everything step is pure busywork.
--   3. Fix "Gather proof of funds documentation" to hold the funds-calculation
--      and bank-letter tasks (previously misassigned to the deleted step 5 row).
--   4. Fix "Submit Express Entry profile" to hold the IRCC-account /
--      submit-profile / record-CRS tasks (previously misassigned to the
--      proof-of-funds row).
--   5. Renumber the remaining steps sequentially (1-6), gap-safe via ROW_NUMBER.
--
-- Pathway UUID: 7214d890-a0c9-44d7-901d-b363e7fdd323 (canada-express-entry-fsw)
-- pathway_steps.id is referenced by step_checklist_progress with ON DELETE CASCADE
-- and by document_requirements.step_id with ON DELETE SET NULL — both deletions
-- below are safe with no orphan risk.

-- ── 1. Remove the redundant manual scoring step ────────────────────────────────
DELETE FROM public.pathway_steps
WHERE pathway_id = '7214d890-a0c9-44d7-901d-b363e7fdd323'
  AND title = 'Calculate selection factor points';

-- ── 2. Remove the no-op "assemble everything" step ─────────────────────────────
DELETE FROM public.pathway_steps
WHERE pathway_id = '7214d890-a0c9-44d7-901d-b363e7fdd323'
  AND title = 'Assemble all required documents';

-- ── 3. Fix proof-of-funds checklist content ────────────────────────────────────
UPDATE public.pathway_steps
SET checklist_items = '[
  {
    "label": "Calculate the minimum funds required for your family size",
    "detail": "IRCC requires proof of accessible funds to support yourself and any accompanying family members on arrival. Current minimums: 1 person $13,757 CAD · 2 people $17,127 · 3 people $21,055 · 4 people $25,564 · 5 people $29,002. These amounts are updated annually — always verify on the IRCC website.",
    "links": [
      { "label": "IRCC proof of funds requirements and current amounts", "url": "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/documents/proof-funds.html" }
    ],
    "tips": [
      "Funds must be liquid and accessible — fixed-term deposits that cannot be withdrawn before maturity do not count.",
      "You do not need proof of funds if you have a valid job offer in Canada from an employer who has an LMIA, or if you are currently authorized to work in Canada."
    ]
  },
  {
    "label": "Obtain official bank letters or 6 months of statements",
    "detail": "Request official letters from your bank on letterhead, showing your name, account number, current balance, and the date. Alternatively, provide 6 months of statements for each account. If your funds are in multiple currencies, include a note showing the CAD equivalent using the current exchange rate.",
    "links": [
      { "label": "Acceptable documents for proof of funds", "url": "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/documents/proof-funds.html" }
    ],
    "tips": [
      "If your funds are split across multiple banks or countries, gather documentation for all accounts and prepare a clear summary sheet."
    ]
  }
]'::jsonb
WHERE pathway_id = '7214d890-a0c9-44d7-901d-b363e7fdd323'
  AND title = 'Gather proof of funds documentation';

-- ── 4. Fix Express Entry profile submission checklist content ─────────────────
UPDATE public.pathway_steps
SET checklist_items = '[
  {
    "label": "Create your IRCC secure online account",
    "detail": "Register for an IRCC account at the portal below. This is where you will create and manage your Express Entry profile, receive your Invitation to Apply, and submit your permanent residence application. Use your legal name exactly as it appears on your passport.",
    "links": [
      { "label": "Create your IRCC account", "url": "https://www.canada.ca/en/immigration-refugees-citizenship/services/application/account.html" }
    ],
    "tips": [
      "Write down your username, password, and security questions immediately. Account recovery can take days and will stall your application."
    ]
  },
  {
    "label": "Complete and submit your Express Entry profile",
    "detail": "Fill in your personal information, work experience, education, language scores, and any job offers or provincial nominations. Review everything carefully before submitting — your profile is active for 12 months and can be updated at any time before you receive an ITA.",
    "links": [
      { "label": "Express Entry profile guide", "url": "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/apply-permanent-residence/express-entry-profile.html" },
      { "label": "Express Entry eligibility tool", "url": "https://www.canada.ca/en/immigration-refugees-citizenship/services/come-canada-tool.html" }
    ],
    "tips": [
      "Double-check all language scores and dates against your official test results. Errors or misrepresentation on your profile can have serious legal consequences."
    ]
  },
  {
    "label": "Record your CRS score and profile number",
    "detail": "After submitting, your Comprehensive Ranking System (CRS) score is calculated and displayed. Note your profile ID and CRS score. Use the IRCC CRS tool to verify the calculation and understand which factors you can improve.",
    "links": [
      { "label": "IRCC CRS calculator", "url": "https://ircc.canada.ca/english/immigrate/skilled/crs-tool.asp" }
    ],
    "tips": [
      "Your CRS score can change if you secure a job offer, improve language scores, or receive a provincial nomination. Update your profile immediately when anything changes — each update is timestamped."
    ]
  }
]'::jsonb
WHERE pathway_id = '7214d890-a0c9-44d7-901d-b363e7fdd323'
  AND title = 'Submit Express Entry profile';

-- ── 5. Renumber remaining steps sequentially, gap-safe ─────────────────────────
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY step_number) AS rn
  FROM public.pathway_steps
  WHERE pathway_id = '7214d890-a0c9-44d7-901d-b363e7fdd323'
)
UPDATE public.pathway_steps p
SET step_number = ranked.rn
FROM ranked
WHERE p.id = ranked.id;
