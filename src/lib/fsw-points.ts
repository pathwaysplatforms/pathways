import type { CrsProfileSource } from './crs-input';

// Source: https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/who-can-apply/federal-skilled-workers/six-selection-factors-federal-skilled-workers.html

export interface FswBreakdown {
  language: number;
  education: number;
  experience: number;
  age: number;
  arrangedEmployment: number;
  adaptability: number;
}

export interface FswEstimate {
  score: number;
  breakdown: FswBreakdown;
  /** True when score >= 67 AND all hard eligibility gates pass. */
  eligible: boolean;
  /** Human-readable reason if eligible === false. */
  ineligibleReason: string | null;
}

// ─── Factor calculators ───────────────────────────────────────────────────────

function clbToFswSkillPts(clb: number): number {
  if (clb >= 9) return 6;
  if (clb === 8) return 5;
  if (clb === 7) return 4;
  return 0;
}

/** Language ability — first official language max 24 pts; no second-language data collected yet. */
function languagePoints(p: CrsProfileSource): number {
  const skills = [p.clb_speaking, p.clb_listening, p.clb_reading, p.clb_writing];
  if (skills.some((v) => v != null)) {
    return skills.reduce<number>((sum, v) => sum + (v != null ? clbToFswSkillPts(v) : 0), 0);
  }
  // Fallback from self-reported proficiency (conservative mapping)
  const map: Record<string, number> = {
    native: 24, fluent: 22, advanced: 16, intermediate: 0, basic: 0,
  };
  return map[p.language_proficiency_self ?? ''] ?? 0;
}

/** Education — max 25 pts. */
function educationPoints(level: string | null | undefined): number {
  const map: Record<string, number> = {
    phd: 25,
    masters: 23,
    two_or_more_credentials: 22,
    bachelors: 20,
    two_year_post_secondary: 19,
    one_year_post_secondary: 15,
    secondary: 5,
    less_than_secondary: 0,
  };
  return map[level ?? ''] ?? 0;
}

/** Work experience in TEER 0–3 (Canadian or foreign) — max 15 pts, minimum 1 continuous year. */
function experiencePoints(p: CrsProfileSource): number {
  if (p.noc_teer_category != null && p.noc_teer_category >= 4) return 0;
  const canadian = p.canadian_work_years ?? 0;
  const foreign = p.foreign_work_years ?? p.years_experience ?? 0;
  const total = Math.max(canadian, foreign, canadian + foreign > 0 ? canadian : 0);
  // FSW accepts Canadian OR foreign skilled work, or a combination.
  // Use total years of qualifying work across both.
  const combined = canadian + (p.foreign_work_years ?? p.years_experience ?? 0);
  const years = Math.max(canadian, combined);
  if (years < 1) return 0;
  if (years >= 6) return 15;
  if (years >= 4) return 13;
  if (years >= 2) return 11;
  return 9;
}

/** Age at time of application — max 12 pts. */
function agePoints(dob: string | null | undefined): number {
  if (!dob) return 0;
  const birth = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  if (age < 18 || age >= 47) return 0;
  if (age <= 35) return 12;
  const table: Record<number, number> = {
    36: 11, 37: 10, 38: 9, 39: 8, 40: 7,
    41: 6,  42: 5,  43: 4, 44: 3, 45: 2, 46: 1,
  };
  return table[age] ?? 0;
}

/** Arranged employment — max 10 pts. */
function arrangedEmploymentPoints(p: CrsProfileSource): number {
  return p.has_canadian_job_offer === true ? 10 : 0;
}

/** Adaptability — max 10 pts (sum of applicable factors, capped). */
function adaptabilityPoints(p: CrsProfileSource): number {
  let pts = 0;
  if ((p.canadian_work_years ?? 0) >= 1) pts += 10;
  if (p.has_sibling_in_canada === true) pts += 5;
  if (p.has_canadian_job_offer === true) pts += 5;
  const spouseScores = [
    p.spouse_clb_speaking, p.spouse_clb_listening,
    p.spouse_clb_reading, p.spouse_clb_writing,
  ].filter((v): v is number => v != null);
  if (p.spouse_coming_to_canada === true && spouseScores.length > 0 && spouseScores.every((s) => s >= 4)) {
    pts += 5;
  }
  return Math.min(pts, 10);
}

// ─── Hard eligibility gates ───────────────────────────────────────────────────

function hardIneligibleReason(p: CrsProfileSource): string | null {
  const skills = [p.clb_speaking, p.clb_listening, p.clb_reading, p.clb_writing].filter(
    (v): v is number => v != null,
  );
  if (skills.length > 0 && skills.some((s) => s < 7)) {
    return 'Minimum CLB 7 required in all four language abilities';
  }
  if (p.noc_teer_category != null && p.noc_teer_category >= 4) {
    return 'TEER 4–5 occupations do not qualify for Federal Skilled Worker';
  }
  return null;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Minimum scoreable fields needed for a meaningful estimate. */
const SCOREABLE_FIELDS: (keyof CrsProfileSource)[] = [
  'clb_speaking', 'clb_listening', 'clb_reading', 'clb_writing',
  'language_proficiency_self', 'education_level', 'years_experience',
  'canadian_work_years', 'date_of_birth',
];

/**
 * Compute an FSW 67-point selection factor estimate from profile data.
 * Returns null when fewer than 3 scoreable fields are present.
 * Source: IRCC federal skilled worker six selection factors grid.
 */
export function computeFswEstimate(p: CrsProfileSource): FswEstimate | null {
  const populated = SCOREABLE_FIELDS.filter((k) => p[k] != null).length;
  if (populated < 3) return null;

  const language = languagePoints(p);
  const education = educationPoints(p.education_level);
  const experience = experiencePoints(p);
  const age = agePoints(p.date_of_birth);
  const arrangedEmployment = arrangedEmploymentPoints(p);
  const adaptability = adaptabilityPoints(p);
  const score = language + education + experience + age + arrangedEmployment + adaptability;

  const ineligibleReason = hardIneligibleReason(p) ?? (score < 67 ? 'Score below the 67-point minimum' : null);

  return {
    score,
    breakdown: { language, education, experience, age, arrangedEmployment, adaptability },
    eligible: ineligibleReason === null,
    ineligibleReason,
  };
}

/** Maximum points each FSW factor can contribute. */
export const FSW_FACTOR_CAPS = {
  language: 28,
  education: 25,
  experience: 15,
  age: 12,
  arrangedEmployment: 10,
  adaptability: 10,
} as const;

/** Human-readable labels for FSW breakdown factors. */
export const FSW_FACTOR_LABELS: Record<keyof FswBreakdown, string> = {
  language: 'Language',
  education: 'Education',
  experience: 'Work experience',
  age: 'Age',
  arrangedEmployment: 'Arranged employment',
  adaptability: 'Adaptability',
};
