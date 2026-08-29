/**
 * Bridge between immigration_chunks.visa_type values and pathways.slug values.
 * Used by the pathway matcher to fetch the most relevant IRCC chunks for each pathway.
 */

export const VISA_TYPE_TO_PATHWAY_SLUGS: Record<string, string[]> = {
  express_entry_fsw:  ['canada-express-entry-fsw', 'express-entry-fsw'],
  express_entry_stem: ['canada-express-entry-stem'],
  // Category-based Express Entry draws
  ee_french_language: ['canada-ee-french'],
  ee_healthcare:      ['canada-ee-healthcare'],
  ee_trades:          ['canada-ee-trades'],
  // Quebec pathways
  quebec_skilled_worker: ['canada-qsw'],
  // Additional PNPs
  pnp_manitoba:     ['canada-pnp-mb'],
  pnp_saskatchewan: ['canada-pnp-sk'],
  express_entry: [
    'canada-express-entry-fsw',
    'canada-cec',
    'canada-fstp',
    'canada-express-entry-stem',
    'express-entry-fsw',
    'express-entry-cec',
    'express-entry-stem',
  ],
  express_entry_crs: [
    'canada-express-entry-fsw',
    'canada-cec',
    'canada-fstp',
    'canada-express-entry-stem',
    'express-entry-fsw',
    'express-entry-cec',
    'express-entry-stem',
  ],
  express_entry_cec: ['canada-cec', 'express-entry-cec'],
  express_entry_fst: ['canada-fstp'],
  pnp_ontario:       ['canada-pnp-ontario'],
  pnp_bc:            ['canada-pnp-bc'],
  pnp_alberta:       ['canada-pnp-alberta'],
  pnp:               ['canada-pnp-ontario', 'canada-pnp-bc', 'canada-pnp-alberta'],
  family_sponsorship:['canada-family-sponsorship'],
  pgwp:              ['canada-pgwp'],
  atlantic_immigration: ['canada-atlantic-immigration'],
  startup_visa:      ['canada-startup-visa'],
  rural_northern_immigration: ['canada-rnip'],
  caregiver:         ['canada-caregiver'],
  bowp:              ['canada-bowp'],
  work_permit:       ['canada-bowp', 'canada-pgwp'],
  general: [
    'canada-express-entry-fsw',
    'canada-cec',
    'canada-pnp-ontario',
    'express-entry-fsw',
    'express-entry-cec',
  ],
  permanent_residence: [
    'canada-express-entry-fsw',
    'canada-cec',
    'express-entry-fsw',
    'express-entry-cec',
  ],
  citizenship:           [],
  processing_times:      [],
  lmia:                  [],
  settlement:            [],
  refugees_humanitarian: [],
  study_permit:          [],
}

/** Returns the visa_types from immigration_chunks relevant to a given pathway slug. */
export function getVisaTypesForSlug(slug: string): string[] {
  return Object.entries(VISA_TYPE_TO_PATHWAY_SLUGS)
    .filter(([, slugs]) => slugs.includes(slug))
    .map(([visaType]) => visaType)
}
