-- Application page (/applications/[applicationId]) full-wire support.
--
-- The ApplicationLayout component renders each step by its `type` and, for
-- document_upload steps, an embedded document requirement. The schema previously
-- had neither: pathway_steps had no type, and document_requirements were
-- pathway-level only (no link to a specific step). These two columns close that
-- gap so the real application page can replace the hardcoded mock.
--
-- Note: existing rows get type='information' and step_id=NULL until pathway
-- content is authored, so steps render as plain information steps until then.

-- 1. Step type drives StepCard rendering (badge, continue label, sub-component).
alter table public.pathway_steps
  add column if not exists type text not null default 'information'
    check (type in ('document_upload', 'information', 'external_action', 'review'));

-- 2. Optional link from a document requirement to the step that needs it.
--    Pathway-level requirements keep step_id = NULL.
alter table public.document_requirements
  add column if not exists step_id uuid references public.pathway_steps(id) on delete set null;

create index if not exists document_requirements_step_id_idx
  on public.document_requirements (step_id);
