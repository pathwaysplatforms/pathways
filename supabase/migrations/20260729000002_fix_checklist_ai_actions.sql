-- Re-apply the ai_action checklist enrichments that 20260727000002_checklist_ai_actions.sql
-- intended to add, but which silently matched zero rows.
--
-- Root cause: that migration matched by hardcoded pathway_steps.id values captured at
-- authoring time. Those row IDs had already gone stale before the migration was ever
-- pushed (the pathway's rows had been re-created with new UUIDs by an earlier reseed/
-- deduplication pass), so every `WHERE id = '...'` matched nothing and no ai_action was
-- ever written. This predates and is unrelated to 20260729000001 (fsw_steps_refine).
--
-- Fix: match by (pathway_id, step_number, item label) instead — the same robust pattern
-- already used successfully by 20260727000001_checklist_input_fields.sql — so this is not
-- sensitive to row IDs or to future step renumbering.
--
-- Pathway: canada-express-entry-fsw (7214d890-a0c9-44d7-901d-b363e7fdd323)

-- Step 2, item 0 — "Collect employer reference letters for each qualifying job"
UPDATE public.pathway_steps
SET checklist_items = jsonb_set(
  checklist_items,
  '{0,ai_action}',
  '{"type":"employer_reference_email","button_label":"Draft reference letter request","modal_title":"Reference Letter Request Email"}'::jsonb
)
WHERE pathway_id = '7214d890-a0c9-44d7-901d-b363e7fdd323'
  AND step_number = 2
  AND (checklist_items->0->>'label') = 'Collect employer reference letters for each qualifying job';

-- Step 3, item 1 — "Receive your official score report"
UPDATE public.pathway_steps
SET checklist_items = jsonb_set(
  checklist_items,
  '{1,ai_action}',
  '{"type":"language_score_email","button_label":"Draft score report request","modal_title":"Language Score Report Request"}'::jsonb
)
WHERE pathway_id = '7214d890-a0c9-44d7-901d-b363e7fdd323'
  AND step_number = 3
  AND (checklist_items->1->>'label') = 'Receive your official score report';

-- Step 4, item 0 — "Apply for your ECA through a designated organization"
UPDATE public.pathway_steps
SET checklist_items = jsonb_set(
  checklist_items,
  '{0,ai_action}',
  '{"type":"eca_inquiry_email","button_label":"Draft application email to WES","modal_title":"ECA Application Email (WES)"}'::jsonb
)
WHERE pathway_id = '7214d890-a0c9-44d7-901d-b363e7fdd323'
  AND step_number = 4
  AND (checklist_items->0->>'label') = 'Apply for your ECA through a designated organization';

-- Step 4, item 1 — "Retrieve your ECA report and reference number"
UPDATE public.pathway_steps
SET checklist_items = jsonb_set(
  checklist_items,
  '{1,ai_action}',
  '{"type":"eca_status_email","button_label":"Draft status follow-up to WES","modal_title":"ECA Status Follow-up Email"}'::jsonb
)
WHERE pathway_id = '7214d890-a0c9-44d7-901d-b363e7fdd323'
  AND step_number = 4
  AND (checklist_items->1->>'label') = 'Retrieve your ECA report and reference number';

-- Step 5, item 1 — "Obtain official bank letters or 6 months of statements"
UPDATE public.pathway_steps
SET checklist_items = jsonb_set(
  checklist_items,
  '{1,ai_action}',
  '{"type":"bank_letter_request_email","button_label":"Draft bank letter request","modal_title":"Proof of Funds Bank Letter Request"}'::jsonb
)
WHERE pathway_id = '7214d890-a0c9-44d7-901d-b363e7fdd323'
  AND step_number = 5
  AND (checklist_items->1->>'label') = 'Obtain official bank letters or 6 months of statements';

-- Step 6, item 1 — "Complete and submit your Express Entry profile"
UPDATE public.pathway_steps
SET checklist_items = jsonb_set(
  checklist_items,
  '{1,ai_action}',
  '{"type":"cover_letter","button_label":"Draft immigration cover letter","modal_title":"Immigration Cover Letter"}'::jsonb
)
WHERE pathway_id = '7214d890-a0c9-44d7-901d-b363e7fdd323'
  AND step_number = 6
  AND (checklist_items->1->>'label') = 'Complete and submit your Express Entry profile';
