-- Dev seed data. Safe to reset locally; do not put production secrets here.
-- Mirrors 20260515_0007_seed_reference_data.sql — ON CONFLICT DO NOTHING keeps this idempotent.

insert into public.countries (name, iso_code, region) values
  ('United Kingdom',  'GB', 'Europe'),
  ('France',          'FR', 'Europe'),
  ('Germany',         'DE', 'Europe'),
  ('Canada',          'CA', 'North America'),
  ('Australia',       'AU', 'Asia-Pacific'),
  ('United States',   'US', 'North America'),
  ('Netherlands',     'NL', 'Europe'),
  ('Portugal',        'PT', 'Europe'),
  ('Spain',           'ES', 'Europe'),
  ('Ireland',         'IE', 'Europe')
on conflict do nothing;

insert into public.pathway_categories (name, slug, description) values
  ('Skilled Worker',        'skilled-worker',        'Work visas for skilled professionals sponsored by a licensed employer'),
  ('Family Reunification',  'family-reunification',  'Visas to join family members who are settled or have status in the country'),
  ('Student',               'student',               'Study visas for international students enrolled at approved institutions'),
  ('Investor',              'investor',              'Visas for high-net-worth individuals investing in the economy')
on conflict do nothing;

with
  uk          as (select id from public.countries where iso_code = 'GB'),
  cat_skilled as (select id from public.pathway_categories where slug = 'skilled-worker'),
  cat_student as (select id from public.pathway_categories where slug = 'student')
insert into public.pathways (
  country_id, category_id, title, slug, official_name, description,
  processing_time_min, processing_time_max, fee_gbp,
  requires_degree, min_years_experience, min_salary_gbp,
  requires_english_test, english_min_score, additional_rules, is_active
) values
  (
    (select id from uk),
    (select id from cat_skilled),
    'UK Skilled Worker Visa',
    'uk-skilled-worker-visa',
    'Skilled Worker visa (formerly Tier 2 General)',
    'Work in the UK with a job offer from a Home Office licensed sponsor. One of the most common routes for skilled professionals outside the EEA.',
    '3 weeks', '8 weeks', 71900,
    false, 0, 2570000,
    true, 'IELTS 4.0 or equivalent',
    '{"points_required": 70, "tradeable_points": true}',
    true
  ),
  (
    (select id from uk),
    (select id from cat_student),
    'UK Student Visa',
    'uk-student-visa',
    'Student visa (formerly Tier 4)',
    'Study at a UK higher education institution. Requires a Confirmation of Acceptance for Studies from an approved sponsor and sufficient funds.',
    '3 weeks', '6 weeks', 49000,
    false, 0, 0,
    true, 'IELTS 5.5 or equivalent',
    '{"requires_cas": true, "can_work_part_time": true, "max_work_hours_term": 20}',
    true
  ),
  (
    (select id from uk),
    (select id from cat_skilled),
    'UK Global Talent Visa',
    'uk-global-talent-visa',
    'Global Talent visa',
    'For leaders and potential leaders in academia, research, arts, culture, and digital technology. No job offer required — recognition of exceptional talent or promise.',
    '8 weeks', '16 weeks', 60800,
    false, 0, 0,
    false, null,
    '{"endorsement_required": true, "no_sponsor_required": true, "eligible_fields": ["academia", "research", "arts", "culture", "digital_technology"]}',
    true
  )
on conflict (slug) do nothing;

with pathway as (select id from public.pathways where slug = 'uk-skilled-worker-visa')
insert into public.document_requirements
  (pathway_id, name, description, document_type, is_mandatory, validity_period, validation_rules, sort_order)
values
  ((select id from pathway), 'Valid passport or travel document', 'Your current, valid passport or travel document showing your identity and nationality', 'passport', true, '6 months', '{"min_validity_months": 6}', 1),
  ((select id from pathway), 'Certificate of Sponsorship', 'A valid Certificate of Sponsorship reference number from your UK employer, confirming the job role and salary', 'certificate_of_sponsorship', true, null, '{"must_not_be_expired": true}', 2),
  ((select id from pathway), 'English language evidence', 'Proof of English ability at B1 level or above — approved test result, UK degree, or exemption', 'english_language_test', true, '2 years', '{"approved_tests": ["IELTS", "TOEFL", "PTE"]}', 3),
  ((select id from pathway), 'Financial evidence', 'Bank statements showing at least £1,270 held for 28 consecutive days', 'bank_statement', true, '1 month', '{"min_balance_gbp": 127000, "consecutive_days": 28}', 4),
  ((select id from pathway), 'Tuberculosis test results', 'Required if you are from a country where TB testing is mandatory for UK visa applications', 'tuberculosis_test', false, '6 months', null, 5)
on conflict do nothing;

with pathway as (select id from public.pathways where slug = 'uk-student-visa')
insert into public.document_requirements
  (pathway_id, name, description, document_type, is_mandatory, validity_period, validation_rules, sort_order)
values
  ((select id from pathway), 'Valid passport', 'Your current, valid passport showing your identity, nationality, and photograph', 'passport', true, '6 months', '{"min_validity_months": 6}', 1),
  ((select id from pathway), 'Confirmation of Acceptance for Studies (CAS)', 'A CAS reference number from your licensed student sponsor confirming your place on an approved course', 'confirmation_of_acceptance', true, null, '{"must_not_be_expired": true}', 2),
  ((select id from pathway), 'English language test results', 'Proof of English ability at the level required by your course — IELTS UKVI or equivalent', 'english_language_test', true, '2 years', '{"approved_tests": ["IELTS UKVI", "TOEFL iBT", "PTE Academic"]}', 3),
  ((select id from pathway), 'Financial evidence', 'Proof of funds to cover tuition fees and living costs for at least one academic year', 'bank_statement', true, '1 month', '{"consecutive_days": 28}', 4),
  ((select id from pathway), 'Academic transcripts and qualifications', 'Certified copies of academic certificates and transcripts supporting your course application', 'academic_transcript', true, null, null, 5),
  ((select id from pathway), 'ATAS clearance certificate', 'Academic Technology Approval Scheme certificate — required for certain science, engineering, and technology subjects', 'atas_certificate', false, null, null, 6)
on conflict do nothing;

with pathway as (select id from public.pathways where slug = 'uk-global-talent-visa')
insert into public.document_requirements
  (pathway_id, name, description, document_type, is_mandatory, validity_period, validation_rules, sort_order)
values
  ((select id from pathway), 'Valid passport', 'Your current, valid passport showing your identity, nationality, and photograph', 'passport', true, '6 months', '{"min_validity_months": 6}', 1),
  ((select id from pathway), 'Endorsement letter', 'An endorsement letter from an approved endorsing body confirming you meet the criteria for exceptional talent or promise', 'endorsement_letter', true, '3 months', '{"approved_bodies": ["Tech Nation", "British Academy", "Arts Council England", "Royal Society"]}', 2),
  ((select id from pathway), 'Evidence of exceptional talent or promise', 'Portfolio of work, publications, awards, citations, or other evidence demonstrating field-leading contributions', 'evidence_portfolio', true, null, null, 3),
  ((select id from pathway), 'CV and professional profile', 'Detailed CV covering education, employment history, and achievements relevant to your field', 'cv', true, null, null, 4)
on conflict do nothing;
