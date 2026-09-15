import type { VoiceExtractedProfile } from "@/modules/voice/types";

// ─── IRCC Comprehensive Ranking System grid ─────────────────────────────────
// Source: https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/check-score/crs-criteria.html
// This is the only CRS scoring implementation in the codebase. Two-column
// tables use "single" when no spouse or partner is coming to Canada and
// "withSpouse" when one is. Not scored because no profile field captures them:
// second official language, French-language bonus, certificate of qualification.

/** Estimator input: extracted profile fields plus CRS-relevant profile-only columns. */
export type CrsInput = Partial<VoiceExtractedProfile> & {
  canadian_education_years?: number | null;
};

export interface CrsBreakdown {
  age: number;
  education: number;
  language: number;
  experience: number;
  spouse: number;
  transferability: number;
  additional: number;
}

export interface CrsEstimate {
  score: number;
  low: number;
  high: number;
  margin: number;
  breakdown: CrsBreakdown;
  /** True when scored with the with-spouse columns and spouse factors. */
  withSpouse: boolean;
  /** True when education points are claimed but no ECA exists yet — IRCC scores foreign education at 0 without one. */
  ecaPending: boolean;
  belowCutoff?: boolean;
  cutoffReason?: string;
}

/** Maximum points each scored core factor and transferability can contribute. */
export interface CrsFactorCaps {
  age: number;
  education: number;
  language: number;
  experience: number;
  transferability: number;
}

type Column = "single" | "withSpouse";
type EducationLevel = NonNullable<VoiceExtractedProfile["education_level"]>;
type SelfAssessedLevel = NonNullable<VoiceExtractedProfile["language_proficiency_self"]>;
type Band = 0 | 1 | 2;

const AGE_POINTS: Record<Column, Readonly<Record<number, number>>> = {
  single: {
    18: 99, 19: 105,
    20: 110, 21: 110, 22: 110, 23: 110, 24: 110, 25: 110, 26: 110, 27: 110, 28: 110, 29: 110,
    30: 105, 31: 99, 32: 94, 33: 88, 34: 83, 35: 77, 36: 72, 37: 66, 38: 61, 39: 55,
    40: 50, 41: 39, 42: 28, 43: 17, 44: 6,
  },
  withSpouse: {
    18: 90, 19: 95,
    20: 100, 21: 100, 22: 100, 23: 100, 24: 100, 25: 100, 26: 100, 27: 100, 28: 100, 29: 100,
    30: 95, 31: 90, 32: 85, 33: 80, 34: 75, 35: 70, 36: 65, 37: 60, 38: 55, 39: 50,
    40: 45, 41: 35, 42: 25, 43: 15, 44: 5,
  },
};

const EDUCATION_POINTS: Record<Column, Readonly<Record<EducationLevel, number>>> = {
  single: {
    less_than_secondary: 0,
    secondary: 30,
    one_year_post_secondary: 90,
    two_year_post_secondary: 98,
    bachelors: 120,
    two_or_more_credentials: 128,
    masters: 135,
    phd: 150,
  },
  withSpouse: {
    less_than_secondary: 0,
    secondary: 28,
    one_year_post_secondary: 84,
    two_year_post_secondary: 91,
    bachelors: 112,
    two_or_more_credentials: 119,
    masters: 126,
    phd: 140,
  },
};

/** First official language points per ability, indexed by CLB level (last row = CLB 10 or more). */
const FIRST_LANGUAGE_POINTS: Record<Column, readonly number[]> = {
  single:     [0, 0, 0, 0, 6, 6, 9, 17, 23, 31, 34],
  withSpouse: [0, 0, 0, 0, 6, 6, 8, 16, 22, 29, 32],
};

/** Canadian skilled work experience points, indexed by years (last row = 5 years or more). */
const CANADIAN_WORK_POINTS: Record<Column, readonly number[]> = {
  single:     [0, 40, 53, 64, 72, 80],
  withSpouse: [0, 35, 46, 56, 63, 70],
};

const SPOUSE_EDUCATION_POINTS: Readonly<Record<EducationLevel, number>> = {
  less_than_secondary: 0,
  secondary: 2,
  one_year_post_secondary: 6,
  two_year_post_secondary: 7,
  bachelors: 8,
  two_or_more_credentials: 9,
  masters: 10,
  phd: 10,
};

/** Spouse first official language points per ability, indexed by CLB level. */
const SPOUSE_LANGUAGE_POINTS: readonly number[] = [0, 0, 0, 0, 0, 1, 1, 3, 3, 5, 5];

/** Spouse Canadian work experience points, indexed by years. */
const SPOUSE_CANADIAN_WORK_POINTS: readonly number[] = [0, 5, 7, 8, 9, 10];

/**
 * Skill transferability points for a pair of factor bands (0 = does not
 * qualify, 1 = lower band, 2 = upper band). IRCC uses this same matrix for all
 * four pairings: education or foreign work, each combined with language or
 * Canadian work.
 */
const TRANSFERABILITY_PAIR_POINTS: readonly (readonly number[])[] = [
  [0, 0, 0],
  [0, 13, 25],
  [0, 25, 50],
];
const TRANSFERABILITY_GROUP_CAP = 50;
const TRANSFERABILITY_CAP = 100;

const PROVINCIAL_NOMINATION_POINTS = 600;
const SIBLING_POINTS = 15;
const CANADIAN_EDUCATION_SHORT_POINTS = 15; // one- or two-year credential
const CANADIAN_EDUCATION_LONG_POINTS = 30;  // three years or longer
const ADDITIONAL_CAP = 600;
const SCORE_CAP = 1200;

const FACTOR_CAPS: Record<Column, CrsFactorCaps> = {
  single:     { age: 110, education: 150, language: 136, experience: 80, transferability: 100 },
  withSpouse: { age: 100, education: 140, language: 128, experience: 70, transferability: 100 },
};

/** Self-assessed proficiency mapped to an assumed CLB level when no test scores exist. */
const SELF_ASSESSED_CLB: Readonly<Record<SelfAssessedLevel, number>> = {
  native: 10, fluent: 9, advanced: 8, intermediate: 7, basic: 5,
};

const POST_SECONDARY_LEVELS = new Set<string>([
  "bachelors", "masters", "phd", "two_or_more_credentials",
  "two_year_post_secondary", "one_year_post_secondary",
]);

/** Read a points table by index, clamping to its last ("or more") row. */
function lookup(table: readonly number[], index: number): number {
  const i = Math.max(0, Math.min(Math.floor(index), table.length - 1));
  return table[i] ?? 0;
}

/** Derive age from an ISO date string (YYYY-MM-DD). */
function computeAge(dob: string): number {
  const birth = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}

function agePoints(dob: string | null | undefined, column: Column): number {
  if (!dob) return 0;
  return AGE_POINTS[column][computeAge(dob)] ?? 0;
}

/**
 * Per-ability first-language CLB levels. Once any test score exists, missing
 * abilities count as CLB 0; otherwise the self-assessed level stands in for
 * all four. Null when there is no language data at all.
 */
function abilityLevels(profile: CrsInput): number[] | null {
  const tested = [profile.clb_speaking, profile.clb_listening, profile.clb_reading, profile.clb_writing];
  if (tested.some((v) => v != null)) return tested.map((v) => v ?? 0);
  if (profile.language_proficiency_self) {
    const clb = SELF_ASSESSED_CLB[profile.language_proficiency_self] ?? 0;
    return [clb, clb, clb, clb];
  }
  return null;
}

/** Average CLB across the abilities provided (self-assessed fallback), used by the cutoff checks. */
function avgCLB(profile: CrsInput): number {
  const scores = [
    profile.clb_speaking, profile.clb_listening,
    profile.clb_reading, profile.clb_writing,
  ].filter((v): v is number => v != null);
  if (scores.length > 0) {
    return scores.reduce((a, b) => a + b, 0) / scores.length;
  }
  return profile.language_proficiency_self
    ? (SELF_ASSESSED_CLB[profile.language_proficiency_self] ?? 0)
    : 0;
}

/** TEER 4–5 work is not skilled experience for CRS; an unknown TEER is not penalised. */
function isSkilledOccupation(profile: CrsInput): boolean {
  return profile.noc_teer_category == null || profile.noc_teer_category <= 3;
}

/** Canadian years as reported; a bare "has Canadian experience" answer counts as one year. */
function reportedCanadianYears(profile: CrsInput): number {
  if (profile.canadian_work_years != null) return profile.canadian_work_years;
  return profile.has_canadian_experience === true ? 1 : 0;
}

/**
 * Foreign years as reported, or total experience minus Canadian years when the
 * split is unknown. Foreign experience flagged as not recent does not count.
 */
function reportedForeignYears(profile: CrsInput): number {
  if (profile.foreign_work_recent === false) return 0;
  if (profile.foreign_work_years != null) return profile.foreign_work_years;
  if (profile.years_experience == null) return 0;
  return Math.max(0, profile.years_experience - reportedCanadianYears(profile));
}

function educationBand(level: EducationLevel | null | undefined): Band {
  if (level === "two_or_more_credentials" || level === "masters" || level === "phd") return 2;
  if (level === "one_year_post_secondary" || level === "two_year_post_secondary" || level === "bachelors") return 1;
  return 0;
}

/** Band 2 needs CLB 9+ in every ability, band 1 needs CLB 7+ in every ability. */
function languageBand(levels: number[] | null): Band {
  if (!levels) return 0;
  const weakest = Math.min(...levels);
  if (weakest >= 9) return 2;
  if (weakest >= 7) return 1;
  return 0;
}

function canadianWorkBand(years: number): Band {
  if (years >= 2) return 2;
  if (years >= 1) return 1;
  return 0;
}

function foreignWorkBand(years: number): Band {
  if (years >= 3) return 2;
  if (years >= 1) return 1;
  return 0;
}

function pairPoints(a: Band, b: Band): number {
  return TRANSFERABILITY_PAIR_POINTS[a]?.[b] ?? 0;
}

function transferabilityPoints(education: Band, language: Band, canadianWork: Band, foreignWork: Band): number {
  const educationGroup = Math.min(
    TRANSFERABILITY_GROUP_CAP,
    pairPoints(education, language) + pairPoints(education, canadianWork),
  );
  const foreignWorkGroup = Math.min(
    TRANSFERABILITY_GROUP_CAP,
    pairPoints(foreignWork, language) + pairPoints(foreignWork, canadianWork),
  );
  return Math.min(TRANSFERABILITY_CAP, educationGroup + foreignWorkGroup);
}

function spousePoints(profile: CrsInput): number {
  const education = profile.spouse_education_level
    ? (SPOUSE_EDUCATION_POINTS[profile.spouse_education_level] ?? 0)
    : 0;
  const language = [
    profile.spouse_clb_speaking, profile.spouse_clb_listening,
    profile.spouse_clb_reading, profile.spouse_clb_writing,
  ].reduce<number>((sum, clb) => sum + (clb != null ? lookup(SPOUSE_LANGUAGE_POINTS, clb) : 0), 0);
  const work = lookup(SPOUSE_CANADIAN_WORK_POINTS, profile.spouse_canadian_work_years ?? 0);
  return education + language + work;
}

/** Section D. IRCC removed arranged-employment points on 2025-03-25, so job offers score nothing. */
function additionalPoints(profile: CrsInput): number {
  let pts = 0;
  if (profile.has_provincial_nomination === true) pts += PROVINCIAL_NOMINATION_POINTS;
  if (profile.has_sibling_in_canada === true) pts += SIBLING_POINTS;
  const canadianEducationYears = profile.canadian_education_years ?? 0;
  if (canadianEducationYears >= 3) pts += CANADIAN_EDUCATION_LONG_POINTS;
  else if (canadianEducationYears >= 1) pts += CANADIAN_EDUCATION_SHORT_POINTS;
  return Math.min(pts, ADDITIONAL_CAP);
}

function scoreableFieldCount(profile: CrsInput): number {
  const fields: (keyof CrsInput)[] = [
    "date_of_birth", "education_level", "eca_obtained",
    "clb_speaking", "clb_listening", "clb_reading", "clb_writing",
    "language_proficiency_self", "canadian_work_years", "foreign_work_years",
    "noc_teer_category", "has_provincial_nomination", "has_sibling_in_canada",
    "canadian_education_years",
  ];
  return fields.filter((k) => profile[k] != null).length;
}

function computeMargin(fieldCount: number): number {
  if (fieldCount <= 4) return 80;
  if (fieldCount <= 6) return 60;
  if (fieldCount <= 8) return 45;
  if (fieldCount <= 11) return 30;
  return 20;
}

/**
 * Estimate a CRS score from a partial profile using the official IRCC grid.
 * Returns null if fewer than 3 scoreable fields are present. The margin widens
 * the range to reflect missing profile data.
 */
export function computeCrsEstimate(profile: CrsInput): CrsEstimate | null {
  const fieldCount = scoreableFieldCount(profile);
  if (fieldCount < 3) return null;

  const withSpouse = profile.spouse_coming_to_canada === true;
  const column: Column = withSpouse ? "withSpouse" : "single";
  const levels = abilityLevels(profile);
  const skilled = isSkilledOccupation(profile);
  const canadianYears = skilled ? reportedCanadianYears(profile) : 0;
  const foreignYears = skilled ? reportedForeignYears(profile) : 0;

  const age = agePoints(profile.date_of_birth, column);
  const education = profile.education_level
    ? (EDUCATION_POINTS[column][profile.education_level] ?? 0)
    : 0;
  const language = levels
    ? levels.reduce((sum, clb) => sum + lookup(FIRST_LANGUAGE_POINTS[column], clb), 0)
    : 0;
  const experience = lookup(CANADIAN_WORK_POINTS[column], canadianYears);
  const spouse = withSpouse ? spousePoints(profile) : 0;
  const transferability = transferabilityPoints(
    educationBand(profile.education_level),
    languageBand(levels),
    canadianWorkBand(canadianYears),
    foreignWorkBand(foreignYears),
  );
  const additional = additionalPoints(profile);
  const score = age + education + language + experience + spouse + transferability + additional;
  const margin = computeMargin(fieldCount);

  let belowCutoff: boolean | undefined;
  let cutoffReason: string | undefined;

  const clbAvg = avgCLB(profile);
  const hasLanguageData = profile.clb_speaking != null || profile.language_proficiency_self != null;
  const hasWorkData = (profile.canadian_work_years ?? profile.years_experience ?? 0) > 0;
  const isPostSecondary = profile.education_level != null && POST_SECONDARY_LEVELS.has(profile.education_level);

  if (hasLanguageData && clbAvg < 7) {
    belowCutoff = true;
    cutoffReason = "Language scores below CLB 7 minimum";
  } else if (profile.education_level != null && !isPostSecondary) {
    belowCutoff = true;
    cutoffReason = "Post-secondary education required for FSW";
  } else if (hasWorkData && !skilled) {
    belowCutoff = true;
    cutoffReason = "TEER 4–5 occupations do not qualify for FSW/CEC";
  }

  return {
    score,
    low: Math.max(0, score - margin),
    high: Math.min(SCORE_CAP, score + margin),
    margin,
    breakdown: { age, education, language, experience, spouse, transferability, additional },
    withSpouse,
    ecaPending: education > 0 && profile.eca_obtained === false,
    belowCutoff,
    cutoffReason,
  };
}

/**
 * Maximum points each scored factor can contribute under the IRCC grid for the
 * given spouse status. Language excludes the unscored second official language.
 * Used to rank improvement levers by remaining headroom.
 */
export function crsFactorCaps(withSpouse: boolean): CrsFactorCaps {
  return FACTOR_CAPS[withSpouse ? "withSpouse" : "single"];
}

/**
 * Real CRS delta from raising every provided CLB ability by one level (capped
 * at CLB 10, where per-ability points max out). Returns null when the profile
 * has no CLB data, no computable estimate, or the bump yields no gain —
 * callers must then present the language lever qualitatively, never invent a number.
 */
export function computeClbPlusOneDelta(profile: CrsInput): number | null {
  const hasClb = [
    profile.clb_speaking, profile.clb_listening,
    profile.clb_reading, profile.clb_writing,
  ].some((v) => v != null);
  if (!hasClb) return null;

  const current = computeCrsEstimate(profile);
  if (current === null) return null;

  const bump = (v: number | null | undefined): number | null | undefined =>
    v != null ? Math.min(v + 1, 10) : v;

  const boosted = computeCrsEstimate({
    ...profile,
    clb_speaking: bump(profile.clb_speaking),
    clb_listening: bump(profile.clb_listening),
    clb_reading: bump(profile.clb_reading),
    clb_writing: bump(profile.clb_writing),
  });
  if (boosted === null) return null;

  const delta = boosted.score - current.score;
  return delta > 0 ? delta : null;
}
