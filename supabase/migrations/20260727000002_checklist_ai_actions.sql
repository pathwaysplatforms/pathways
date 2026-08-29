-- Adds ai_action to FSW checklist items where AI-generated drafts add value.
-- Each action maps to a generator in src/modules/ai/service.ts.
-- Pathway: canada-express-entry-fsw (7214d890-a0c9-44d7-901d-b363e7fdd323)

-- Step 2, item 0 — "Collect employer reference letters"
UPDATE public.pathway_steps
SET checklist_items = jsonb_set(
  checklist_items,
  '{0,ai_action}',
  '{"type":"employer_reference_email","button_label":"Draft reference letter request","modal_title":"Reference Letter Request Email"}'::jsonb
)
WHERE id = '07ec61aa-5a04-44a8-b38f-f8856ab7691d';

-- Step 3, item 1 — "Receive your official score report"
UPDATE public.pathway_steps
SET checklist_items = jsonb_set(
  checklist_items,
  '{1,ai_action}',
  '{"type":"language_score_email","button_label":"Draft score report request","modal_title":"Language Score Report Request"}'::jsonb
)
WHERE id = 'bdd85205-b4f7-47c2-80f9-5958c5b526a1';

-- Step 4, item 0 — "Apply for your ECA through a designated organization"
UPDATE public.pathway_steps
SET checklist_items = jsonb_set(
  checklist_items,
  '{0,ai_action}',
  '{"type":"eca_inquiry_email","button_label":"Draft application email to WES","modal_title":"ECA Application Email (WES)"}'::jsonb
)
WHERE id = 'dbe61a0f-1757-4cc1-b355-3aadaa59fb6a';

-- Step 4, item 1 — "Retrieve your ECA report and reference number"
UPDATE public.pathway_steps
SET checklist_items = jsonb_set(
  checklist_items,
  '{1,ai_action}',
  '{"type":"eca_status_email","button_label":"Draft status follow-up to WES","modal_title":"ECA Status Follow-up Email"}'::jsonb
)
WHERE id = 'dbe61a0f-1757-4cc1-b355-3aadaa59fb6a';

-- Step 5, item 1 — "Obtain official bank letters or 6 months of statements"
UPDATE public.pathway_steps
SET checklist_items = jsonb_set(
  checklist_items,
  '{1,ai_action}',
  '{"type":"bank_letter_request_email","button_label":"Draft bank letter request","modal_title":"Proof of Funds Bank Letter Request"}'::jsonb
)
WHERE id = 'ae301b6c-9e45-4cf7-96d8-eb1501c013de';

-- Step 6, item 1 — "Complete and submit your Express Entry profile"
UPDATE public.pathway_steps
SET checklist_items = jsonb_set(
  checklist_items,
  '{1,ai_action}',
  '{"type":"cover_letter","button_label":"Draft immigration cover letter","modal_title":"Immigration Cover Letter"}'::jsonb
)
WHERE id = 'a015e71f-5dcc-405f-8ffa-d478344d8951';

-- ─── Candidate list for other pathways (not yet implemented) ───────────────────
-- CEC:   employer_reference_email on "Gather Canadian work experience letters"
-- PNP:   pnp_inquiry_email on "Submit provincial nomination application"
-- SUV:   commitment_letter_request on "Secure commitment from designated org"
-- FST:   trade_cert_request_email on "Get your trade certificate recognized"
-- AIPP:  employer_support_email on "Confirm employment with Atlantic employer"
-- Rural: employer_support_email on "Obtain eligible employer job offer"
