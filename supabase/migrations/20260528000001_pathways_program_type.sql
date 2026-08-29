alter table public.pathways
  add column if not exists program_type text;

update public.pathways set program_type = 'express_entry'
  where slug in ('express-entry-fsw', 'express-entry-cec');

update public.pathways set program_type = 'express_entry_category'
  where slug = 'express-entry-stem';

update public.pathways set program_type = 'skilled_worker'
  where slug in ('uk-skilled-worker-visa', 'uk-global-talent-visa');

update public.pathways set program_type = 'student'
  where slug = 'uk-student-visa';
