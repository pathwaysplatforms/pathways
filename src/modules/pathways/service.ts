import type { Logger } from 'pino';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { DatabaseError, NotFoundError } from '@/lib/errors';
import type { MatcherProfile, MatchResult, ApplicationData, StepType } from './types';

// ─── CRS point tables ────────────────────────────────────────────────────────
// Each constant is named so audits and IRCC grid updates are easy to locate.

const EDUCATION_PTS: Record<string, number> = {
  less_than_secondary:      0,
  secondary:               28,
  one_year_post_secondary: 84,
  two_year_post_secondary: 91,
  bachelors:              112,
  two_or_more_credentials:119,
  masters:                126,
  phd:                    140,
};

function clbPts(clb: number | null): number {
  if (clb === null) return 0;
  if (clb >= 10) return 34;
  if (clb === 9)  return 32;
  if (clb === 8)  return 22;
  if (clb === 7)  return 16;
  if (clb === 6)  return 8;
  if (clb >= 4)   return 6;
  return 0;
}

function canadianWorkPts(years: number | null): number {
  if (!years) return 0;
  if (years >= 5) return 80;
  return ([0, 40, 53, 64, 72] as const)[years] ?? 72;
}

const SPOUSE_EDU_RATIO   = 0.5;   // spouse education pts at 50% of single rate
const SPOUSE_CLB_RATIO   = 0.5;   // spouse CLB pts at ~50% of single rate (simplified)
const SPOUSE_WORK_RATIO  = 0.5;

// ─── Age point tables (IRCC CRS section A) ───────────────────────────────────
// Source: https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/eligibility/criteria-comprehensive-ranking-system/grid.html
// Ages outside 18–44 score 0. Values are per the 2024-current IRCC grid.

const AGE_PTS_NO_SPOUSE: Record<number, number> = {
  18: 99,  19: 105,
  20: 110, 21: 110, 22: 110, 23: 110, 24: 110,
  25: 110, 26: 110, 27: 110, 28: 110, 29: 110,
  30: 105,
  31: 99,  32: 94,  33: 88,  34: 83,  35: 77,
  36: 72,  37: 66,  38: 61,  39: 55,  40: 50,
  41: 39,  42: 28,  43: 17,  44: 6,
};

const AGE_PTS_WITH_SPOUSE: Record<number, number> = {
  18: 90,  19: 95,
  20: 100, 21: 100, 22: 100, 23: 100, 24: 100,
  25: 100, 26: 100, 27: 100, 28: 100, 29: 100,
  30: 95,
  31: 90,  32: 85,  33: 80,  34: 75,  35: 70,
  36: 65,  37: 60,  38: 55,  39: 50,  40: 45,
  41: 35,  42: 25,  43: 15,  44: 5,
};

function agePts(dateOfBirth: string | null, hasSpouse: boolean): number {
  if (!dateOfBirth) return 0;
  const today = new Date();
  const dob = new Date(dateOfBirth);
  let age = today.getFullYear() - dob.getFullYear();
  const pastBirthday =
    today.getMonth() > dob.getMonth() ||
    (today.getMonth() === dob.getMonth() && today.getDate() >= dob.getDate());
  if (!pastBirthday) age--;
  const table = hasSpouse ? AGE_PTS_WITH_SPOUSE : AGE_PTS_NO_SPOUSE;
  return table[age] ?? 0;
}

// ─── Additional / bonus factors ──────────────────────────────────────────────
const PN_PTS              = 600;
const JOB_OFFER_TEER0_PTS = 200;
const JOB_OFFER_OTHER_PTS = 50;
const SIBLING_PTS         = 15;
const CDN_EDU_SHORT_PTS   = 15;   // 1–2 years
const CDN_EDU_LONG_PTS    = 30;   // 3+ years

// ─── CRS calculation ─────────────────────────────────────────────────────────

/**
 * Calculates a CRS score from a MatcherProfile.
 *
 * Includes: education, language, Canadian work, age, spouse factors, and bonus factors.
 * Skill transferability is not yet implemented (~50–100 pts depending on profile).
 *
 * Mental check — single applicant, age 30 (105), bachelor's (112), CLB 9 all (128),
 * no Canadian work: 345 pts. Add skill transferability → ~450 pts.
 */
export function calculateCRS(profile: MatcherProfile): number {
  const hasSpouse = profile.spouse_coming_to_canada === true;

  // ── Age ────────────────────────────────────────────────────────────────────
  const agePtsVal = agePts(profile.date_of_birth, hasSpouse);

  // ── Education ──────────────────────────────────────────────────────────────
  let eduPts = 0;
  if (profile.education_level) {
    eduPts = EDUCATION_PTS[profile.education_level] ?? 0;
  } else if (profile.has_degree) {
    // has_degree=true but level unknown → conservative bachelors estimate
    eduPts = EDUCATION_PTS.bachelors;
  }

  // ── Language (first official language) ────────────────────────────────────
  const langPts =
    clbPts(profile.clb_speaking)   +
    clbPts(profile.clb_listening)  +
    clbPts(profile.clb_reading)    +
    clbPts(profile.clb_writing);

  // ── Canadian work experience ───────────────────────────────────────────────
  const workPts = canadianWorkPts(profile.canadian_work_years);

  // ── Spouse factors (if applicable) ────────────────────────────────────────
  let spouseEduPts  = 0;
  let spouseLangPts = 0;
  let spouseWorkPts = 0;
  if (hasSpouse) {
    if (profile.spouse_education_level) {
      spouseEduPts = Math.round(
        (EDUCATION_PTS[profile.spouse_education_level] ?? 0) * SPOUSE_EDU_RATIO,
      );
    }
    spouseLangPts = Math.round(
      (clbPts(profile.spouse_clb_speaking)  +
       clbPts(profile.spouse_clb_listening) +
       clbPts(profile.spouse_clb_reading)   +
       clbPts(profile.spouse_clb_writing))  * SPOUSE_CLB_RATIO,
    );
    spouseWorkPts = Math.round(
      canadianWorkPts(profile.spouse_canadian_work_years) * SPOUSE_WORK_RATIO,
    );
  }

  // ── Additional / bonus factors ────────────────────────────────────────────
  const pnPts = profile.has_provincial_nomination ? PN_PTS : 0;

  let jobOfferPts = 0;
  if (profile.has_canadian_job_offer) {
    jobOfferPts = (profile.noc_teer_category === 0)
      ? JOB_OFFER_TEER0_PTS
      : JOB_OFFER_OTHER_PTS;
  }

  const siblingPts = profile.has_sibling_in_canada ? SIBLING_PTS : 0;

  return (
    agePtsVal + eduPts + langPts + workPts +
    spouseEduPts + spouseLangPts + spouseWorkPts +
    pnPts + jobOfferPts + siblingPts
  );
}

// ─── Eligibility gates ───────────────────────────────────────────────────────

interface EligibilityResult {
  eligible: boolean;
  met: string[];
  missing: string[];
  missingData: string[];
}

function minClb(p: MatcherProfile): number | null {
  const vals = [p.clb_speaking, p.clb_listening, p.clb_reading, p.clb_writing]
    .filter((v): v is number => v !== null);
  return vals.length === 4 ? Math.min(...vals) : null;
}

function checkClb(
  p: MatcherProfile,
  required: number,
  met: string[],
  missing: string[],
  missingData: string[],
): boolean {
  const abilities = [p.clb_speaking, p.clb_listening, p.clb_reading, p.clb_writing];
  const allPresent = abilities.every(v => v !== null);
  const anyPresent = abilities.some(v => v !== null);

  if (!anyPresent) {
    missingData.push('clb_scores');
    return true; // don't disqualify on null
  }
  if (!allPresent) missingData.push('some_clb_scores');

  const min = minClb(p);
  if (min !== null && min < required) {
    missing.push(`CLB ${required} required in all four language abilities (lowest present: CLB ${min})`);
    return false;
  }
  met.push(`Language scores meet CLB ${required} minimum`);
  return true;
}

function checkFSW(p: MatcherProfile): EligibilityResult {
  const met: string[] = [];
  const missing: string[] = [];
  const missingData: string[] = [];
  let eligible = true;

  // Gate 1: NOC TEER 0–3
  if (p.noc_teer_category === null) {
    missingData.push('noc_teer_category');
  } else if (p.noc_teer_category > 3) {
    eligible = false;
    missing.push('FSW requires a TEER 0–3 occupation (your occupation is TEER ' + p.noc_teer_category + ')');
  } else {
    met.push('Occupation qualifies for FSW (TEER 0–3)');
  }

  // Gate 2: 1 year skilled work experience
  if (p.years_experience === null) {
    missingData.push('years_experience');
  } else if (p.years_experience < 1) {
    eligible = false;
    missing.push('FSW requires at least 1 year of skilled work experience');
  } else {
    met.push(`Work experience qualifies (${p.years_experience} year${p.years_experience !== 1 ? 's' : ''})`);
  }

  // Gate 3: CLB 7 in all four abilities
  if (eligible || !missing.length) {
    const clbOk = checkClb(p, 7, met, missing, missingData);
    if (!clbOk) eligible = false;
  }

  // Gate 4: post-secondary degree
  if (p.has_degree === null) {
    missingData.push('has_degree');
  } else if (!p.has_degree) {
    eligible = false;
    missing.push('FSW requires a post-secondary degree (or equivalent ECA)');
  } else {
    met.push('Holds a post-secondary degree');
  }

  return { eligible, met, missing, missingData };
}

function checkCEC(p: MatcherProfile): EligibilityResult {
  const met: string[] = [];
  const missing: string[] = [];
  const missingData: string[] = [];
  let eligible = true;

  // Gate 1: NOC TEER 0–3
  if (p.noc_teer_category === null) {
    missingData.push('noc_teer_category');
  } else if (p.noc_teer_category > 3) {
    eligible = false;
    missing.push('CEC requires a TEER 0–3 occupation');
  } else {
    met.push('Occupation qualifies for CEC (TEER 0–3)');
  }

  // Gate 2: 1 year Canadian work experience, recent
  if (p.canadian_work_years === null) {
    missingData.push('canadian_work_years');
  } else if (p.canadian_work_years < 1 || !p.canadian_work_recent) {
    eligible = false;
    missing.push('CEC requires at least 1 year of recent Canadian work experience');
  } else {
    met.push(`Canadian work experience qualifies (${p.canadian_work_years} year${p.canadian_work_years !== 1 ? 's' : ''}, recent)`);
  }

  // Gate 3: CLB 7 for TEER 0–1, CLB 5 for TEER 2–3
  const teer = p.noc_teer_category;
  const clbRequired = (teer !== null && teer >= 2) ? 5 : 7;
  const clbOk = checkClb(p, clbRequired, met, missing, missingData);
  if (!clbOk) eligible = false;

  return { eligible, met, missing, missingData };
}

function checkSTEM(p: MatcherProfile): EligibilityResult {
  const fswResult = checkFSW(p);
  const cecResult = checkCEC(p);
  const passesUnderlying = fswResult.eligible || cecResult.eligible;

  if (!passesUnderlying) {
    return {
      eligible: false,
      met: [],
      missing: ['STEM category requires eligibility under FSW or CEC first', ...fswResult.missing, ...cecResult.missing],
      missingData: [...new Set([...fswResult.missingData, ...cecResult.missingData])],
    };
  }

  const base = fswResult.eligible ? fswResult : cecResult;
  const met: string[] = [...base.met];
  const missing: string[] = [];
  const missingData: string[] = [...base.missingData];
  let eligible = true;

  // Extra STEM gate: TEER 0–2
  if (p.noc_teer_category === null) {
    missingData.push('noc_teer_category');
  } else if (p.noc_teer_category > 2) {
    eligible = false;
    missing.push('STEM category requires a TEER 0–2 occupation');
  } else {
    met.push('STEM-eligible occupation (TEER 0–2)');
  }

  return { eligible, met, missing: [...base.missing, ...missing], missingData };
}

function checkEligibility(slug: string, p: MatcherProfile): EligibilityResult {
  switch (slug) {
    case 'express-entry-fsw':  return checkFSW(p);
    case 'express-entry-cec':  return checkCEC(p);
    case 'express-entry-stem': return checkSTEM(p);
    default: return { eligible: false, met: [], missing: ['Eligibility rules not yet defined for this pathway'], missingData: [] };
  }
}

// ─── Draw cutoff lookup ───────────────────────────────────────────────────────

const DRAW_TYPE_MAP: Record<string, string[]> = {
  'express-entry-fsw':  ['fsw', 'general'],
  'express-entry-cec':  ['cec', 'general'],
  'express-entry-stem': ['stem'],
};

// Fallback cutoffs when immigration_draws is empty (scraper hasn't run yet)
const FALLBACK_CUTOFFS: Record<string, number> = {
  general: 525,
  fsw:     510,
  cec:     510,
  stem:    490,
};

interface ITAResult {
  likelihood: MatchResult['ita_likelihood'];
  cutoff: number | null;
  date: string | null;
}

function getITALikelihood(
  slug: string,
  crsScore: number,
  latestByType: Record<string, { cutoff: number; date: string }>,
): ITAResult {
  const drawTypes = DRAW_TYPE_MAP[slug] ?? [];

  // Find the lowest (most restrictive) cutoff across relevant draw types
  let cutoff: number | null = null;
  let date: string | null = null;

  for (const dt of drawTypes) {
    const row = latestByType[dt];
    if (row) {
      if (cutoff === null || row.cutoff < cutoff) {
        cutoff = row.cutoff;
        date = row.date;
      }
    }
  }

  // Fall back to hardcoded cutoffs if no live data
  if (cutoff === null) {
    for (const dt of drawTypes) {
      const fb = FALLBACK_CUTOFFS[dt];
      if (fb !== undefined) {
        if (cutoff === null || fb < cutoff) cutoff = fb;
      }
    }
  }

  if (cutoff === null) return { likelihood: 'unknown', cutoff: null, date: null };

  const likelihood: MatchResult['ita_likelihood'] =
    crsScore >= cutoff + 20 ? 'high'   :
    crsScore >= cutoff - 10 ? 'medium' :
    'low';

  return { likelihood, cutoff, date };
}

// ─── Main matcher function ───────────────────────────────────────────────────

/** Fetches profile + pathways + draw data and returns a ranked MatchResult[]. */
export async function matchPathways(
  profileId: string,
  logger: Logger,
): Promise<MatchResult[]> {
  logger.info({ action: 'matchPathways.start', profileId });

  // supabase types are stale pending `supabase gen types --local`
  const db = createSupabaseServerClient() as unknown as SupabaseClient;

  // ── Query 1: profile ────────────────────────────────────────────────────────
  const { data: profileRow, error: profileErr } = await db
    .from('profiles')
    .select(`
      id,
      has_degree, years_experience, education_level, eca_obtained,
      clb_speaking, clb_listening, clb_reading, clb_writing,
      canadian_work_years, foreign_work_years,
      canadian_work_recent, foreign_work_recent,
      noc_teer_category,
      spouse_coming_to_canada, spouse_education_level,
      spouse_clb_speaking, spouse_clb_listening,
      spouse_clb_reading, spouse_clb_writing,
      spouse_canadian_work_years,
      has_provincial_nomination, has_canadian_job_offer, has_sibling_in_canada,
      date_of_birth
    `)
    .eq('id', profileId)
    .single();

  if (profileErr || !profileRow) {
    throw new DatabaseError('Profile not found for matcher', { profileId }, profileErr);
  }

  const profile = profileRow as MatcherProfile;

  // ── Query 2: active express-entry pathways ──────────────────────────────────
  const { data: pathwayRows, error: pathwayErr } = await db
    .from('pathways')
    .select('id, slug, title, official_name, description, processing_time_min, processing_time_max, program_type')
    .eq('is_active', true)
    .like('program_type', 'express_entry%');

  if (pathwayErr) {
    throw new DatabaseError('Failed to fetch pathways', {}, pathwayErr);
  }

  // ── Query 3: latest draw results ────────────────────────────────────────────
  const { data: drawRows } = await db
    .from('immigration_draws')
    .select('draw_type, cutoff_score, draw_date')
    .eq('country', 'canada')
    .eq('program', 'express_entry')
    .not('cutoff_score', 'is', null)
    .order('draw_date', { ascending: false })
    .limit(50);

  // Deduplicate: keep the most recent row per draw_type
  const latestByType: Record<string, { cutoff: number; date: string }> = {};
  for (const row of (drawRows ?? [])) {
    if (row.draw_type && !latestByType[row.draw_type]) {
      latestByType[row.draw_type] = { cutoff: row.cutoff_score as number, date: row.draw_date as string };
    }
  }

  // ── Calculate CRS once (same for all pathways) ──────────────────────────────
  const crsScore = calculateCRS(profile);

  // ── Build MatchResult per pathway ───────────────────────────────────────────
  const results: MatchResult[] = (pathwayRows ?? []).map((pw) => {
    const eligibility = checkEligibility(pw.slug as string, profile);
    const ita = getITALikelihood(pw.slug as string, crsScore, latestByType);

    const missingData = [
      ...new Set([
        ...eligibility.missingData,
        ...(profile.date_of_birth === null ? ['date_of_birth'] : []),
      ]),
    ];

    return {
      pathway: {
        id:                  pw.id as string,
        slug:                pw.slug as string,
        title:               pw.title as string,
        official_name:       pw.official_name as string,
        description:         pw.description as string,
        processing_time_min: pw.processing_time_min as string,
        processing_time_max: pw.processing_time_max as string,
        program_type:        pw.program_type as string,
      },
      eligible:         eligibility.eligible,
      crs_score:        crsScore,
      ita_likelihood:   ita.likelihood,
      latest_cutoff:    ita.cutoff,
      latest_draw_date: ita.date,
      criteria_met:     eligibility.met,
      criteria_missing: eligibility.missing,
      missing_data:     missingData,
    };
  });

  // ── Sort: eligible → ita_likelihood → crs_score ────────────────────────────
  const LIKELIHOOD_RANK: Record<MatchResult['ita_likelihood'], number> = {
    high: 3, medium: 2, low: 1, unknown: 0,
  };

  results.sort((a, b) => {
    if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
    const lDiff = LIKELIHOOD_RANK[b.ita_likelihood] - LIKELIHOOD_RANK[a.ita_likelihood];
    if (lDiff !== 0) return lDiff;
    return b.crs_score - a.crs_score;
  });

  logger.info({ action: 'matchPathways.done', profileId, count: results.length, crsScore });
  return results;
}

// ─── Application data fetcher ─────────────────────────────────────────────────

/** Fetches an application and its ordered pathway steps from the database. */
export async function getApplicationData(
  applicationId: string,
  logger: Logger,
): Promise<ApplicationData> {
  logger.info({ action: 'getApplicationData.start', applicationId });

  // supabase types are stale pending `supabase gen types --local`
  const db = createSupabaseServerClient() as unknown as SupabaseClient;

  // ── Query 1: application with nested pathway ───────────────────────────────
  const { data: appRow, error: appErr } = await db
    .from('applications')
    .select(`
      id,
      status,
      submitted_at,
      pathway:pathways!pathway_id (
        id,
        slug,
        title,
        official_name
      )
    `)
    .eq('id', applicationId)
    .single();

  if (appErr || !appRow) {
    if (appErr?.code === 'PGRST116') {
      throw new NotFoundError('Application not found', { applicationId });
    }
    throw new DatabaseError('Failed to fetch application', { applicationId }, appErr ?? undefined);
  }

  type AppRow = {
    id: string;
    status: string;
    submitted_at: string | null;
    pathway: { id: string; slug: string; title: string; official_name: string };
  };
  const app = appRow as unknown as AppRow;

  // ── Query 2: pathway steps with document_requirements join ─────────────────
  const { data: stepRows, error: stepsErr } = await db
    .from('pathway_steps')
    .select(`
      id,
      step_number,
      title,
      description,
      type,
      estimated_duration,
      is_optional,
      document_requirement_id,
      document_requirement:document_requirements!document_requirement_id (
        name,
        description,
        document_type,
        validity_period,
        validation_rules
      )
    `)
    .eq('pathway_id', app.pathway.id)
    .order('step_number', { ascending: true });

  if (stepsErr) {
    throw new DatabaseError('Failed to fetch pathway steps', { applicationId }, stepsErr);
  }

  // ── Query 3: completed step IDs for this application ──────────────────────
  const { data: completionRows, error: completionsErr } = await db
    .from('application_step_completions')
    .select('step_id')
    .eq('application_id', applicationId);

  if (completionsErr) {
    throw new DatabaseError('Failed to fetch step completions', { applicationId }, completionsErr);
  }

  const completedIds = new Set<string>((completionRows ?? []).map((r: { step_id: string }) => r.step_id));

  type DocReqRow = {
    name: string;
    description: string;
    document_type: string;
    validity_period: string | null;
    validation_rules: Record<string, unknown> | null;
  };

  type StepRow = {
    id: string;
    step_number: number;
    title: string;
    description: string;
    type: StepType;
    estimated_duration: string;
    is_optional: boolean;
    document_requirement_id: string | null;
    document_requirement: DocReqRow | null;
  };

  // Derive step statuses from completion set:
  // completed → completed, first non-completed → current, rest → upcoming
  let foundCurrent = false;
  const steps = ((stepRows ?? []) as unknown as StepRow[]).map((s: StepRow) => {
    let status: 'completed' | 'current' | 'upcoming';
    if (completedIds.has(s.id)) {
      status = 'completed';
    } else if (!foundCurrent) {
      foundCurrent = true;
      status = 'current';
    } else {
      status = 'upcoming';
    }

    const doc = s.document_requirement;
    const validationRules = doc?.validation_rules as {
      accepted_formats?: string[];
      max_size_mb?: number;
    } | null;

    return {
      id: s.id,
      step_number: s.step_number,
      title: s.title,
      description: s.description,
      type: s.type,
      estimated_duration: s.estimated_duration,
      is_optional: s.is_optional,
      document_requirement_id: s.document_requirement_id,
      status,
      ...(s.type === 'document_upload' && doc
        ? {
            document: {
              name: doc.name,
              description: doc.description,
              document_type: doc.document_type,
              validity_period: doc.validity_period,
              accepted_formats: validationRules?.accepted_formats ?? [],
              max_size_mb: validationRules?.max_size_mb ?? 10,
            },
          }
        : {}),
    };
  });

  logger.info({ action: 'getApplicationData.done', applicationId, stepCount: steps.length });

  return {
    id: app.id,
    status: app.status,
    submitted_at: app.submitted_at,
    pathway: {
      slug: app.pathway.slug,
      title: app.pathway.title,
      official_name: app.pathway.official_name,
    },
    steps,
  };
}
