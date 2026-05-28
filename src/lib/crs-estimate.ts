import type { VoiceExtractedProfile } from "@/modules/voice/types";

export interface CrsBreakdown {
  age: number;
  education: number;
  language: number;
  experience: number;
  transferability: number;
  additional: number;
}

export interface CrsEstimate {
  score: number;
  low: number;
  high: number;
  margin: number;
  breakdown: CrsBreakdown;
  belowCutoff?: boolean;
  cutoffReason?: string;
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

function agePoints(dob: string | null | undefined): number {
  if (!dob) return 0;
  const age = computeAge(dob);
  if (age < 18) return 0;
  if (age <= 35) return 100;
  const table: Record<number, number> = {
    36: 95, 37: 90, 38: 85, 39: 80,
    40: 75, 41: 70, 42: 65, 43: 60, 44: 55,
  };
  return table[age] ?? 0;
}

function educationPoints(
  level: string | null | undefined,
  ecaObtained: boolean | null | undefined,
): number {
  const table: Record<string, number> = {
    phd: 150,
    masters: 135,
    two_or_more_credentials: 128,
    bachelors: 120,
    two_year_post_secondary: 98,
    one_year_post_secondary: 90,
    secondary: 30,
    less_than_secondary: 0,
  };
  if (!level) return 0;
  let pts = table[level] ?? 0;
  const isPostSecondary = pts >= 90;
  if (isPostSecondary && ecaObtained === false) pts = Math.max(0, pts - 10);
  return pts;
}

function clbToSkillPoints(clb: number): number {
  if (clb >= 10) return 34;
  if (clb === 9) return 31;
  if (clb === 8) return 23;
  if (clb === 7) return 17;
  if (clb === 6) return 9;
  if (clb >= 4) return 6;
  return 0;
}

function languagePoints(profile: Partial<VoiceExtractedProfile>): number {
  const { clb_speaking, clb_listening, clb_reading, clb_writing, language_proficiency_self } = profile;
  const allCLB = [clb_speaking, clb_listening, clb_reading, clb_writing];
  if (allCLB.some((v) => v != null)) {
    return allCLB.reduce<number>((sum, v) => sum + (v != null ? clbToSkillPoints(v) : 0), 0);
  }
  if (language_proficiency_self) {
    const profMap: Record<string, number> = {
      native: 128, fluent: 116, advanced: 74, intermediate: 36, basic: 6,
    };
    return profMap[language_proficiency_self] ?? 0;
  }
  return 0;
}

/** Compute the average CLB level for FSW gate checks. */
export function avgCLB(profile: Partial<VoiceExtractedProfile>): number {
  const scores = [
    profile.clb_speaking, profile.clb_listening,
    profile.clb_reading, profile.clb_writing,
  ].filter((v): v is number => v != null);
  if (scores.length > 0) {
    return scores.reduce((a, b) => a + b, 0) / scores.length;
  }
  const profMap: Record<string, number> = {
    native: 10, fluent: 9, advanced: 8, intermediate: 7, basic: 5,
  };
  return profile.language_proficiency_self
    ? (profMap[profile.language_proficiency_self] ?? 0)
    : 0;
}

function workPoints(profile: Partial<VoiceExtractedProfile>): number {
  const { noc_teer_category, canadian_work_years, foreign_work_years, foreign_work_recent, years_experience } = profile;
  if (noc_teer_category != null && noc_teer_category >= 4) return 0;

  const canYears = canadian_work_years ?? (years_experience ?? 0);
  const canTable: Record<number, number> = { 0: 0, 1: 40, 2: 53 };
  const canPts = canYears >= 3 ? 64 : (canTable[canYears] ?? 0);

  let forPts = 0;
  const forYears = foreign_work_years ?? 0;
  if (foreign_work_recent === true && forYears > 0) {
    if (forYears === 1) forPts = 6;
    else if (forYears <= 3) forPts = 8;
    else forPts = 11;
  }
  return Math.min(canPts + forPts, 70);
}

const POST_SECONDARY_LEVELS = new Set([
  "bachelors", "masters", "phd", "two_or_more_credentials",
  "two_year_post_secondary", "one_year_post_secondary",
]);

function transferabilityPoints(
  profile: Partial<VoiceExtractedProfile>,
  langPts: number,
  workPts: number,
  eduPts: number,
): number {
  if (langPts === 0 || workPts === 0 || eduPts === 0) return 0;
  const strongLang = avgCLB(profile) >= 9;
  const postSecondary = profile.education_level != null && POST_SECONDARY_LEVELS.has(profile.education_level);
  const canExp = (profile.canadian_work_years ?? 0) >= 1;
  const foreignExp = (profile.foreign_work_years ?? 0) >= 3;
  let pts = 0;
  if (strongLang && postSecondary) pts += 50;
  if (canExp && strongLang) pts += 50;
  if (canExp && postSecondary) pts += 25;
  if (foreignExp && strongLang) pts += 25;
  return Math.min(pts, 100);
}

function additionalPoints(profile: Partial<VoiceExtractedProfile>): number {
  let pts = 0;
  if (profile.has_provincial_nomination === true) pts += 600;
  if (profile.has_canadian_job_offer === true) pts += 50;
  if (profile.has_sibling_in_canada === true) pts += 15;
  const spouseScores = [
    profile.spouse_clb_speaking, profile.spouse_clb_listening,
    profile.spouse_clb_reading, profile.spouse_clb_writing,
  ].filter((v): v is number => v != null);
  const spouseAvg = spouseScores.length > 0
    ? spouseScores.reduce((a, b) => a + b, 0) / spouseScores.length
    : 0;
  if (profile.spouse_coming_to_canada === true && spouseAvg >= 5) pts += 20;
  return pts;
}

function scoreableFieldCount(profile: Partial<VoiceExtractedProfile>): number {
  const fields: (keyof VoiceExtractedProfile)[] = [
    "date_of_birth", "education_level", "eca_obtained",
    "clb_speaking", "clb_listening", "clb_reading", "clb_writing",
    "language_proficiency_self", "canadian_work_years", "foreign_work_years",
    "noc_teer_category", "has_provincial_nomination", "has_canadian_job_offer",
    "has_sibling_in_canada",
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
 * Compute a simplified CRS score estimate from a partial extracted voice profile.
 * Returns null if fewer than 3 scoreable fields are present.
 */
export function computeCrsEstimate(profile: Partial<VoiceExtractedProfile>): CrsEstimate | null {
  const fieldCount = scoreableFieldCount(profile);
  if (fieldCount < 3) return null;

  const age = agePoints(profile.date_of_birth);
  const education = educationPoints(profile.education_level, profile.eca_obtained);
  const language = languagePoints(profile);
  const experience = workPoints(profile);
  const transferability = transferabilityPoints(profile, language, experience, education);
  const additional = additionalPoints(profile);
  const score = age + education + language + experience + transferability + additional;
  const margin = computeMargin(fieldCount);

  let belowCutoff: boolean | undefined;
  let cutoffReason: string | undefined;

  const clbAvg = avgCLB(profile);
  const hasLanguageData = profile.clb_speaking != null || profile.language_proficiency_self != null;
  const hasWorkData = (profile.canadian_work_years ?? profile.years_experience ?? 0) > 0;
  const isPostSecondary = profile.education_level != null && POST_SECONDARY_LEVELS.has(profile.education_level);
  const nocQualified = profile.noc_teer_category == null || profile.noc_teer_category <= 3;

  if (hasLanguageData && clbAvg < 7) {
    belowCutoff = true;
    cutoffReason = "Language scores below CLB 7 minimum";
  } else if (profile.education_level != null && !isPostSecondary) {
    belowCutoff = true;
    cutoffReason = "Post-secondary education required for FSW";
  } else if (hasWorkData && !nocQualified) {
    belowCutoff = true;
    cutoffReason = "TEER 4–5 occupations do not qualify for FSW/CEC";
  }

  return {
    score,
    low: Math.max(0, score - margin),
    high: Math.min(1200, score + margin),
    margin,
    breakdown: { age, education, language, experience, transferability, additional },
    belowCutoff,
    cutoffReason,
  };
}
