-- Add recency flags for work experience eligibility checks
-- Add raw NOC code storage
-- Add CHECK constraints for education level enum values

alter table public.profiles
  add column canadian_work_recent  boolean default false,
  add column foreign_work_recent   boolean default false,
  add column noc_code              text;

alter table public.profiles
  add constraint profiles_education_level_check
  check (education_level in (
    'less_than_secondary', 'secondary', 'one_year_post_secondary',
    'two_year_post_secondary', 'bachelors', 'two_or_more_credentials',
    'masters', 'phd'
  ));

alter table public.profiles
  add constraint profiles_spouse_education_level_check
  check (spouse_education_level in (
    'less_than_secondary', 'secondary', 'one_year_post_secondary',
    'two_year_post_secondary', 'bachelors', 'two_or_more_credentials',
    'masters', 'phd'
  ));