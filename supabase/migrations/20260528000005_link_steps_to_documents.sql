-- FSW: link document_upload steps to their document_requirements

-- Step 2: Language test
update public.pathway_steps ps
set document_requirement_id = (
  select dr.id from public.document_requirements dr
  join public.pathways p on p.id = dr.pathway_id
  where p.slug = 'express-entry-fsw'
  and dr.document_type = 'language_test'
)
where ps.pathway_id = (select id from public.pathways where slug = 'express-entry-fsw')
and ps.step_number = 2;

-- Step 3: ECA
update public.pathway_steps ps
set document_requirement_id = (
  select dr.id from public.document_requirements dr
  join public.pathways p on p.id = dr.pathway_id
  where p.slug = 'express-entry-fsw'
  and dr.document_type = 'eca_report'
)
where ps.pathway_id = (select id from public.pathways where slug = 'express-entry-fsw')
and ps.step_number = 3;

-- Step 4: Employment reference
update public.pathway_steps ps
set document_requirement_id = (
  select dr.id from public.document_requirements dr
  join public.pathways p on p.id = dr.pathway_id
  where p.slug = 'express-entry-fsw'
  and dr.document_type = 'employment_reference'
)
where ps.pathway_id = (select id from public.pathways where slug = 'express-entry-fsw')
and ps.step_number = 4;

-- Step 5: Bank statement
update public.pathway_steps ps
set document_requirement_id = (
  select dr.id from public.document_requirements dr
  join public.pathways p on p.id = dr.pathway_id
  where p.slug = 'express-entry-fsw'
  and dr.document_type = 'bank_statement'
)
where ps.pathway_id = (select id from public.pathways where slug = 'express-entry-fsw')
and ps.step_number = 5;

-- CEC: link document_upload steps

-- Step 2: Language test
update public.pathway_steps ps
set document_requirement_id = (
  select dr.id from public.document_requirements dr
  join public.pathways p on p.id = dr.pathway_id
  where p.slug = 'express-entry-cec'
  and dr.document_type = 'language_test'
)
where ps.pathway_id = (select id from public.pathways where slug = 'express-entry-cec')
and ps.step_number = 2;

-- Step 3: Employment records
update public.pathway_steps ps
set document_requirement_id = (
  select dr.id from public.document_requirements dr
  join public.pathways p on p.id = dr.pathway_id
  where p.slug = 'express-entry-cec'
  and dr.document_type = 'employment_reference'
)
where ps.pathway_id = (select id from public.pathways where slug = 'express-entry-cec')
and ps.step_number = 3;

-- Step 4: NOC confirmation
update public.pathway_steps ps
set document_requirement_id = (
  select dr.id from public.document_requirements dr
  join public.pathways p on p.id = dr.pathway_id
  where p.slug = 'express-entry-cec'
  and dr.document_type = 'noc_confirmation'
)
where ps.pathway_id = (select id from public.pathways where slug = 'express-entry-cec')
and ps.step_number = 4;
