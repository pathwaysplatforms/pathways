-- Remove the "Calculate selection factor points" step from canada-express-entry-fsw.
--
-- Rationale: FSW 67-point eligibility is now computed automatically by the platform
-- from the user's profile (language CLB scores, education, work experience, age,
-- arranged employment, adaptability). Showing it as a manual user task is misleading.
--
-- After deletion, steps 6-12 are renumbered 5-11 to close the gap.
-- document_requirements.step_id has ON DELETE SET NULL, so any doc requirements
-- previously linked to step 5 are auto-nulled by the DELETE — no orphan risk.

DELETE FROM public.pathway_steps
WHERE pathway_id = '7214d890-a0c9-44d7-901d-b363e7fdd323'
  AND step_number = 5;

UPDATE public.pathway_steps
SET step_number = step_number - 1
WHERE pathway_id = '7214d890-a0c9-44d7-901d-b363e7fdd323'
  AND step_number > 5;
