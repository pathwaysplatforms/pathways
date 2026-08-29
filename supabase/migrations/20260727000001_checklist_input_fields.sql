-- Adds input_field to checklist items that require the user to record a found value.
-- Uses jsonb_set so only the target key is touched; the rest of each object is unchanged.
-- Pathway: canada-express-entry-fsw (7214d890-a0c9-44d7-901d-b363e7fdd323)

-- Step 1 item 0: "Identify your NOC code" → capture profiles.noc_code
UPDATE public.pathway_steps
SET checklist_items = jsonb_set(
  checklist_items,
  '{0,input_field}',
  '{
    "label": "Your NOC code",
    "placeholder": "e.g. 21231",
    "key": "noc_code",
    "hint": "5-digit code from the NOC 2021 list — the second digit is your TEER level (0–5).",
    "type": "text"
  }'::jsonb
)
WHERE pathway_id = '7214d890-a0c9-44d7-901d-b363e7fdd323'
  AND step_number = 1
  AND (checklist_items->0->>'label') = 'Identify your NOC code';

-- Step 3 item 0: "Book your language test" → no numeric capture needed, skip.
-- Annual income is collected during onboarding, not a step-level capture.
