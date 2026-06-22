-- Backfill Canadian pathway step types and document step_id links.
--
-- Three logical changes, kept atomic in one transaction:
--   1. Remove duplicate passport row on canada-express-entry-stem (336753fa kept
--      the wrong sort_order=10 copy; e5a8aa85 at sort_order=0 is the canonical row).
--   2. Reclassify pathway_steps.type from 'information' (the schema default) to
--      'document_upload' or 'external_action' per the closed-vocabulary heuristic
--      audited in docs/backfill/proposal.md (2026-06-19).
--   3. Set document_requirements.step_id for the 11 doc→step pairs where the step
--      title names the specific document being gathered.
--
-- Uncertain external_action steps (FSW step 7, Family Sponsorship step 7,
-- FSTP step 8, RNIP step 6) are included — all confirmed in review.
-- No schema changes — only data mutations on existing columns.

begin;

-- ── 1. STEM duplicate cleanup ──────────────────────────────────────────────────
-- Keep e5a8aa85 ("Passport or travel document", sort_order=0).
-- Delete 336753fa ("Valid passport", sort_order=10) — true duplicate, same
-- document_type/is_mandatory, copy-pasted from another pathway template.

delete from public.document_requirements
  where id = '336753fa-ae7f-4171-b70f-fd0cced00452';


-- ── 2. Type backfill: information → document_upload ────────────────────────────
-- Pattern: step title is "Gather/Develop/Obtain [a specific named document]"
-- AND at least one document_requirements row's name clearly matches.

update public.pathway_steps
  set type = 'document_upload'
  where id in (
    -- AIP:      Develop settlement plan with service provider
    'f955e3b3-e2fa-46ec-a0df-38685457954b',
    -- CEC:      Gather educational credentials (if applicable)
    '94dd6341-3a02-4e3a-a3cb-a66c66f18fd0',
    -- FSW:      Obtain Educational Credential Assessment if applicable
    '131d2857-712a-4b77-a237-83b7536119f5',
    -- FSW:      Gather proof of funds if required
    '5c93acd5-e50e-405f-8f0f-804b48aea696',
    -- FSTP:     Obtain job offer or certificate of qualification
    '8eaa4a5c-4205-4b0c-af41-8074cea14e44',
    -- FSTP:     Gather proof of funds or confirm employment status
    '6719c3c3-8e6b-4121-acaf-8370d4233724',
    -- Caregiver: Gather required documentation
    'e5bea886-24cc-487f-9059-ea7dd25ce89b',
    -- Startup:  Obtain letter of support from designated organization
    '01e8bf2b-ff44-479a-86da-f49391b41883'
  );


-- ── 3. Type backfill: information → external_action ───────────────────────────
-- Pattern: step title is "Submit/Apply/Register [via IRCC / provincial portal / PR Portal]"
-- or "Obtain [government-issued item]" where obtain means submitting an application.
-- Steps marked [uncertain] in proposal are confirmed included by reviewer.

update public.pathway_steps
  set type = 'external_action'
  where id in (
    -- AIP:               Apply for work permit (if required)          [optional]
    'ebd2b6fc-3234-482a-bfaf-dc2e8be323ac',
    -- AIP:               Submit permanent residence application to IRCC
    '65e9e23d-3739-4b0a-a52f-a5042105c2f5',
    -- BOWP:              Submit BOWP application online
    'dbf435ad-4090-41ad-ba8f-954ab1623256',
    -- CEC:               Submit application after Invitation to Apply
    '27b7025d-f123-4b92-92e9-d90e79dd917a',
    -- Express Entry:     Submit Permanent Residency Application
    '86fb5100-5b63-4828-b7a6-ff6cdbe5990e',
    -- FSW:               Create and submit Express Entry profile       [uncertain]
    '03cd6725-4552-4d95-a8c6-6d2226ff448e',
    -- FSW:               Submit e-APR within 60 days
    '013d8023-d731-4518-b185-1be232ae5774',
    -- STEM:              Submit permanent residence application
    '477500dd-48d0-49ba-a659-42bd3206d986',
    -- Family Sponsorship: Submit complete application
    'b434ef0d-1a1e-441d-b222-23a0ff91fcd4',
    -- Family Sponsorship: Obtain Quebec undertaking (if applicable)   [uncertain][optional]
    'e269c698-8d2a-4fe1-9717-63bc07c49431',
    -- FSTP:              Create Express Entry profile and submit application [uncertain]
    'dc9c577e-e308-42bd-a5fe-a7040e2a6365',
    -- Caregiver:         Submit application
    '97af1506-ed15-4cca-a0d5-d6a5a2f5ca13',
    -- Caregiver:         Submit proof of additional work experience    [optional]
    '4f36aa22-d17f-49ff-a3e4-484be3f25b45',
    -- OINP:              Register expression of interest
    'ccca9869-8997-47f8-93a6-f248b363a4d5',
    -- OINP:              Submit application to OINP
    'b0ddcdad-5fa4-4c10-8090-49a5872eabf5',
    -- OINP:              Apply for permanent residence to federal government
    '3091f489-b85a-4432-af6e-427c76e83edd',
    -- PGWP:              Apply for PGWP within 180 days of completion
    '6c0e0a5f-e36e-4f20-98a0-bb466c17c065',
    -- Provincial Nominee: Submit Provincial Application
    'c01c627b-d4c7-4a34-aa3b-127bbdefff6b',
    -- Provincial Nominee: Apply for Permanent Residency
    '74b12ffd-209c-4a16-98ba-a7d637893fd1',
    -- RNIP:              Submit community recommendation application
    '962cf2c0-1ada-45c2-9849-64afe3e8090f',
    -- RNIP:              Apply for permanent residence
    '4394c4d7-3403-452c-846d-6443ee5fe2f9',
    -- RNIP:              Apply for work permit (optional)              [uncertain][optional]
    '10c6cc02-26e7-40ec-82bd-a6afcfb61682'
  );


-- ── 4. Document step_id links ─────────────────────────────────────────────────
-- Set step_id only where the doc name is a clear match for what the step title
-- says to gather/obtain. 11 links across 6 pathways.

-- AIP: Settlement plan → Develop settlement plan (step 3)
update public.document_requirements
  set step_id = 'f955e3b3-e2fa-46ec-a0df-38685457954b'
  where id = 'd8f61d7e-5116-4bb0-940a-4072f17fa5f2';

-- CEC: ECA report + Canadian education credential → Gather educational credentials (step 4)
update public.document_requirements
  set step_id = '94dd6341-3a02-4e3a-a3cb-a66c66f18fd0'
  where id in (
    '91ebdfef-927e-4d96-b8c5-ea325b6cf25a',  -- Educational credential assessment (ECA) report
    '1c5313f7-a7a8-427c-af18-bd6f5258898a'   -- Canadian education credential
  );

-- FSW: ECA report → Obtain Educational Credential Assessment (step 4)
update public.document_requirements
  set step_id = '131d2857-712a-4b77-a237-83b7536119f5'
  where id = '706471f4-f630-410d-80b0-32ebd717caa6';  -- Educational Credential Assessment report

-- FSW: Proof of funds → Gather proof of funds if required (step 6)
update public.document_requirements
  set step_id = '5c93acd5-e50e-405f-8f0f-804b48aea696'
  where id = '8ace1509-4efd-478b-849d-e4a87c935db0';  -- Proof of funds

-- FSTP: Certificate of qualification + Valid job offer → Obtain job offer or cert (step 3)
update public.document_requirements
  set step_id = '8eaa4a5c-4205-4b0c-af41-8074cea14e44'
  where id in (
    '368acc71-05be-42f2-9fdd-94f4a8b7db1d',  -- Certificate of qualification
    '5626a01e-e637-40ef-94a5-93036cb8464a'   -- Valid job offer
  );

-- FSTP: Proof of funds → Gather proof of funds or confirm employment status (step 5)
update public.document_requirements
  set step_id = '6719c3c3-8e6b-4121-acaf-8370d4233724'
  where id = 'eddf9202-b5ce-40f4-9b95-a3642c9f2e65';  -- Proof of funds

-- Caregiver: both work experience docs → Gather required documentation (step 3)
update public.document_requirements
  set step_id = 'e5bea886-24cc-487f-9059-ea7dd25ce89b'
  where id in (
    'd73dd837-c107-45fb-81ed-4e13f115f140',  -- Proof of qualifying work experience
    '4535f261-0182-4bba-ab39-3316dab18a5f'   -- Work history documentation
  );

-- Startup: Letter of support → Obtain letter of support from designated organization (step 1)
update public.document_requirements
  set step_id = '01e8bf2b-ff44-479a-86da-f49391b41883'
  where id = '97fcae4e-bcab-4869-a70a-2947ff48c07d';  -- Letter of support from designated organization


-- ── Sanity assertions ─────────────────────────────────────────────────────────
-- Fail the transaction if expected row counts are wrong, catching any UUID typo
-- before this reaches production.

do $$
declare
  v_doc_upload_count   int;
  v_ext_action_count   int;
  v_step_id_link_count int;
  v_stem_dup_count     int;
begin
  select count(*) into v_doc_upload_count
    from public.pathway_steps
    where id in (
      'f955e3b3-e2fa-46ec-a0df-38685457954b',
      '94dd6341-3a02-4e3a-a3cb-a66c66f18fd0',
      '131d2857-712a-4b77-a237-83b7536119f5',
      '5c93acd5-e50e-405f-8f0f-804b48aea696',
      '8eaa4a5c-4205-4b0c-af41-8074cea14e44',
      '6719c3c3-8e6b-4121-acaf-8370d4233724',
      'e5bea886-24cc-487f-9059-ea7dd25ce89b',
      '01e8bf2b-ff44-479a-86da-f49391b41883'
    )
    and type = 'document_upload';

  select count(*) into v_ext_action_count
    from public.pathway_steps
    where id in (
      'ebd2b6fc-3234-482a-bfaf-dc2e8be323ac',
      '65e9e23d-3739-4b0a-a52f-a5042105c2f5',
      'dbf435ad-4090-41ad-ba8f-954ab1623256',
      '27b7025d-f123-4b92-92e9-d90e79dd917a',
      '86fb5100-5b63-4828-b7a6-ff6cdbe5990e',
      '03cd6725-4552-4d95-a8c6-6d2226ff448e',
      '013d8023-d731-4518-b185-1be232ae5774',
      '477500dd-48d0-49ba-a659-42bd3206d986',
      'b434ef0d-1a1e-441d-b222-23a0ff91fcd4',
      'e269c698-8d2a-4fe1-9717-63bc07c49431',
      'dc9c577e-e308-42bd-a5fe-a7040e2a6365',
      '97af1506-ed15-4cca-a0d5-d6a5a2f5ca13',
      '4f36aa22-d17f-49ff-a3e4-484be3f25b45',
      'ccca9869-8997-47f8-93a6-f248b363a4d5',
      'b0ddcdad-5fa4-4c10-8090-49a5872eabf5',
      '3091f489-b85a-4432-af6e-427c76e83edd',
      '6c0e0a5f-e36e-4f20-98a0-bb466c17c065',
      'c01c627b-d4c7-4a34-aa3b-127bbdefff6b',
      '74b12ffd-209c-4a16-98ba-a7d637893fd1',
      '962cf2c0-1ada-45c2-9849-64afe3e8090f',
      '4394c4d7-3403-452c-846d-6443ee5fe2f9',
      '10c6cc02-26e7-40ec-82bd-a6afcfb61682'
    )
    and type = 'external_action';

  select count(*) into v_step_id_link_count
    from public.document_requirements
    where id in (
      'd8f61d7e-5116-4bb0-940a-4072f17fa5f2',
      '91ebdfef-927e-4d96-b8c5-ea325b6cf25a',
      '1c5313f7-a7a8-427c-af18-bd6f5258898a',
      '706471f4-f630-410d-80b0-32ebd717caa6',
      '8ace1509-4efd-478b-849d-e4a87c935db0',
      '368acc71-05be-42f2-9fdd-94f4a8b7db1d',
      '5626a01e-e637-40ef-94a5-93036cb8464a',
      'eddf9202-b5ce-40f4-9b95-a3642c9f2e65',
      'd73dd837-c107-45fb-81ed-4e13f115f140',
      '4535f261-0182-4bba-ab39-3316dab18a5f',
      '97fcae4e-bcab-4869-a70a-2947ff48c07d'
    )
    and step_id is not null;

  select count(*) into v_stem_dup_count
    from public.document_requirements
    where id = '336753fa-ae7f-4171-b70f-fd0cced00452';

  if v_doc_upload_count  <> 8  then raise exception 'Expected 8 document_upload steps, got %',  v_doc_upload_count;  end if;
  if v_ext_action_count  <> 22 then raise exception 'Expected 22 external_action steps, got %', v_ext_action_count;  end if;
  if v_step_id_link_count <> 11 then raise exception 'Expected 11 step_id links, got %',        v_step_id_link_count; end if;
  if v_stem_dup_count    <> 0  then raise exception 'STEM duplicate row was not deleted';        end if;
end $$;

commit;
