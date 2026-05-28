alter table public.pathway_steps
  add column if not exists type text not null default 'external_action';

update public.pathway_steps ps
set type = 'information'
where ps.pathway_id = (select id from public.pathways where slug = 'express-entry-fsw')
  and ps.step_number = 1;

update public.pathway_steps ps
set type = 'document_upload'
where ps.pathway_id = (select id from public.pathways where slug = 'express-entry-fsw')
  and ps.step_number in (2, 3, 4, 5);

update public.pathway_steps ps
set type = 'review'
where ps.pathway_id = (select id from public.pathways where slug = 'express-entry-fsw')
  and ps.step_number = 8;

update public.pathway_steps ps
set type = 'document_upload'
where ps.pathway_id = (select id from public.pathways where slug = 'express-entry-cec')
  and ps.step_number in (2, 3, 4);

update public.pathway_steps ps
set type = 'review'
where ps.pathway_id = (select id from public.pathways where slug = 'express-entry-cec')
  and ps.step_number = 7;
