-- Expand profiles table with structured immigration data
-- needed for accurate CRS scoring and pathway matching

alter table public.profiles

  -- Language: individual CLB scores per ability (required for CRS)
  add column clb_reading        int,   -- 0–12
  add column clb_writing        int,
  add column clb_speaking       int,
  add column clb_listening      int,

  -- Second official language (French for English speakers, English for French)
  add column second_lang_reading   int,
  add column second_lang_writing   int,
  add column second_lang_speaking  int,
  add column second_lang_listening int,

  -- French specifically (NCLC scale, needed for French bonus calculation)
  add column nclc_reading       int,
  add column nclc_writing       int,
  add column nclc_speaking      int,
  add column nclc_listening     int,

  -- Work experience split (CRS treats Canadian and foreign work differently)
  add column canadian_work_years  int default 0,  -- years worked in Canada
  add column foreign_work_years   int default 0,  -- years worked abroad

  -- Occupation classification (needed for FSW/CEC eligibility)
  add column noc_teer_category  int,  -- 0, 1, 2, 3, 4, or 5

  -- Education (structured, replaces free-text degree_level)
  add column education_level    text,
  -- values: less_than_secondary | secondary | one_year_post_secondary |
  --         two_year_post_secondary | bachelors | two_or_more_credentials |
  --         masters | phd
  add column canadian_education_years  int default 0,  -- 0, 1, 2, or 3 (3=3+)
  add column eca_obtained       boolean default false,

  -- Spouse / partner (affects CRS section A and B)
  add column spouse_coming_to_canada    boolean default false,
  add column spouse_education_level     text,
  add column spouse_clb_reading         int,
  add column spouse_clb_writing         int,
  add column spouse_clb_speaking        int,
  add column spouse_clb_listening       int,
  add column spouse_canadian_work_years int default 0,

  -- Additional CRS factors
  add column has_sibling_in_canada      boolean default false,
  add column has_provincial_nomination  boolean default false,
  add column has_canadian_job_offer     boolean default false,
  add column has_trade_certificate      boolean default false,

  -- Profile completeness tracking
  add column profile_completeness_pct   int default 0,  -- 0–100
  add column incomplete_fields          text[],         -- array of field names
  add column voice_profile_version      int default 1;  -- increments on re-intake