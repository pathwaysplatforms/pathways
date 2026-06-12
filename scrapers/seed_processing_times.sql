-- Processing time seeds for all canada-* pathways.
-- Units are months. Run against the target database manually.
-- Source: IRCC published processing times, approximate as of early 2026.

-- Express Entry streams: 6-month target
UPDATE pathways SET processing_time_min = '5', processing_time_max = '7' WHERE slug = 'canada-express-entry-fsw';
UPDATE pathways SET processing_time_min = '5', processing_time_max = '7' WHERE slug = 'canada-express-entry-stem';
UPDATE pathways SET processing_time_min = '5', processing_time_max = '7' WHERE slug = 'canada-cec';

-- PNP streams: slower due to provincial + federal stage
UPDATE pathways SET processing_time_min = '12', processing_time_max = '18' WHERE slug = 'canada-pnp-bc';
UPDATE pathways SET processing_time_min = '12', processing_time_max = '18' WHERE slug = 'canada-pnp-ontario';
UPDATE pathways SET processing_time_min = '12', processing_time_max = '18' WHERE slug = 'canada-pnp-alberta';

-- PGWP: issued at port of entry, processing varies
UPDATE pathways SET processing_time_min = '2', processing_time_max = '5' WHERE slug = 'canada-pgwp';

-- BOWP: bridge open work permit
UPDATE pathways SET processing_time_min = '2', processing_time_max = '4' WHERE slug = 'canada-bowp';

-- Family sponsorship: spouse/partner
UPDATE pathways SET processing_time_min = '10', processing_time_max = '14' WHERE slug = 'canada-family-sponsorship';

-- Atlantic Immigration Program
UPDATE pathways SET processing_time_min = '6', processing_time_max = '12' WHERE slug = 'canada-atlantic-immigration';

-- Rural and Northern Immigration Pilot
UPDATE pathways SET processing_time_min = '12', processing_time_max = '24' WHERE slug = 'canada-rnip';

-- Startup Visa
UPDATE pathways SET processing_time_min = '12', processing_time_max = '36' WHERE slug = 'canada-startup-visa';

-- Caregiver
UPDATE pathways SET processing_time_min = '18', processing_time_max = '24' WHERE slug = 'canada-caregiver';

-- Federal Skilled Trades
UPDATE pathways SET processing_time_min = '5', processing_time_max = '7' WHERE slug = 'canada-fstp';
