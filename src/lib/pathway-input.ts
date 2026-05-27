import type { VoiceExtractedProfile } from "@/modules/voice/types";

/** Education levels in the canonical Express Entry taxonomy. */
export type EducationLevel =
  | "less_than_secondary"
  | "secondary"
  | "one_year_post_secondary"
  | "two_year_post_secondary"
  | "bachelors"
  | "two_or_more_credentials"
  | "masters"
  | "phd";

/** The structured document passed to the pathway matching engine. */
export interface PathwayInput {
  profile_id: string;
  collected_at: string;
  schema_version: "1.0";

  personal: {
    age: number;
    date_of_birth: string;
    nationality: string;
    current_country: string;
    marital_status:
      | "single"
      | "married"
      | "common_law"
      | "separated"
      | "divorced"
      | "widowed";
    spouse_accompanying: boolean;
  };

  education: {
    level_self_reported: string;
    level_normalized: EducationLevel | null;
  };

  work: {
    occupation: string;
    years_experience_total: number;
    has_canadian_experience: boolean;
    noc_teer_inferred: 0 | 1 | 2 | 3 | 4 | 5 | null;
  };

  language: {
    primary_language: "english" | "french" | "both" | "other";
    self_assessed_level: "native" | "fluent" | "advanced" | "intermediate" | "basic";
    clb_scores_available: false;
  };

  family: {
    has_family_in_canada: boolean;
    has_spouse_or_common_law: boolean;
  };

  finances: {
    annual_income_original: number;
    income_currency: string;
    income_cad_estimate: number | null;
  };

  preferences: {
    destination_province: string | null;
  };

  crs_estimate: {
    range_low: number;
    range_high: number;
    confidence: "low";
    based_on: string[];
    missing_for_exact: string[];
  };

  data_completeness_pct: number;
  collection_method: "voice" | "chat" | "form";
  voice_session_id: string | null;
}

/** CRS estimate output with context fields. */
export interface CrsEstimate {
  low: number;
  high: number;
  midpoint: number;
  basedOn: string[];
  missingForExact: string[];
}

/** Map from self-reported education text to normalized EducationLevel. */
function normalizeEducationLevel(raw: string | null): EducationLevel | null {
  if (!raw) return null;
  const lower = raw.toLowerCase();
  if (lower.includes("phd") || lower.includes("doctor")) return "phd";
  if (lower.includes("master") || lower.includes("mba") || lower.includes("msc") || lower.includes("ma ") || lower.includes("m.a") || lower.includes("m.s")) return "masters";
  if (lower.includes("bachelor") || lower.includes("undergraduate") || lower.includes("bsc") || lower.includes("b.a") || lower.includes("b.sc")) return "bachelors";
  if (lower.includes("two") || lower.includes("2 year") || lower.includes("diploma")) return "two_year_post_secondary";
  if (lower.includes("one year") || lower.includes("1 year") || lower.includes("certificate")) return "one_year_post_secondary";
  if (lower.includes("high school") || lower.includes("secondary") || lower.includes("gcse") || lower.includes("a-level")) return "secondary";
  return null;
}

/** Infer NOC TEER category from occupation title and education level. */
function inferNocTeer(
  occupation: string | null,
  education: EducationLevel | null
): 0 | 1 | 2 | 3 | 4 | 5 | null {
  if (!occupation) return null;
  const lower = occupation.toLowerCase();

  if (lower.includes("surgeon") || lower.includes("judge") || lower.includes("pilot") || lower.includes("physician") || lower.includes("lawyer") || lower.includes("architect")) return 0;

  if (lower.includes("engineer") || lower.includes("software") || lower.includes("developer") || lower.includes("analyst") || lower.includes("manager") || lower.includes("nurse") || lower.includes("teacher") || lower.includes("accountant")) {
    return education === "phd" || education === "masters" ? 0 : 1;
  }

  if (lower.includes("technician") || lower.includes("technologist") || lower.includes("coordinator") || lower.includes("supervisor") || lower.includes("designer")) return 2;

  if (lower.includes("tradesperson") || lower.includes("electrician") || lower.includes("plumber") || lower.includes("carpenter") || lower.includes("welder")) return 3;

  if (lower.includes("support") || lower.includes("assistant") || lower.includes("clerk") || lower.includes("operator")) return 4;

  if (lower.includes("labourer") || lower.includes("helper") || lower.includes("cleaner") || lower.includes("harvester")) return 5;

  return null;
}

/** Compute age in whole years from a YYYY-MM-DD date string. */
function computeAge(dateOfBirth: string | null): number | null {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  if (isNaN(dob.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}

/** Normalize marital_status to the canonical enum values. */
function normalizeMaritalStatus(
  raw: string | null
): PathwayInput["personal"]["marital_status"] {
  if (!raw) return "single";
  const lower = raw.toLowerCase().replace(/-/g, "_");
  if (lower.includes("common")) return "common_law";
  if (lower.includes("divorced") || lower.includes("divorcé")) return "divorced";
  if (lower.includes("separated") || lower.includes("séparé")) return "separated";
  if (lower.includes("widowed") || lower.includes("veuf")) return "widowed";
  if (lower.includes("married") || lower.includes("marié")) return "married";
  return "single";
}

/** Normalize language_proficiency_self to primary_language. */
function inferPrimaryLanguage(
  occupation: string | null,
  nationality: string | null
): PathwayInput["language"]["primary_language"] {
  if (!nationality) return "english";
  const lower = (nationality + " " + (occupation ?? "")).toLowerCase();
  if (lower.includes("france") || lower.includes("belgium") || lower.includes("switzerland") || lower.includes("québec") || lower.includes("morocco") || lower.includes("tunisia") || lower.includes("algeria")) return "french";
  return "english";
}

/**
 * Compute a conservative rough CRS range estimate from limited profile data.
 *
 * This is intentionally low-confidence — always err toward a lower range
 * to avoid false hope. The exact score requires CLB test results, NOC code,
 * ECA certificate, and spouse details not collected at this stage.
 */
export function computeCrsEstimate(input: PathwayInput): CrsEstimate {
  let total = 0;
  const basedOn: string[] = [];
  const missingForExact: string[] = [
    "IELTS/CELPIP/TEF scores",
    "NOC code",
    "ECA certificate",
    "Spouse CLB scores",
  ];

  const age = input.personal.age;
  if (age > 0) {
    let agePts = 0;
    if (age >= 20 && age <= 29) agePts = 110;
    else if (age >= 30 && age <= 34) agePts = 95;
    else if (age >= 35 && age <= 39) agePts = 75;
    else if (age >= 40 && age <= 44) agePts = 50;
    else if (age < 20) agePts = 90;
    else agePts = 0;
    total += agePts;
    if (agePts > 0) basedOn.push("age");
  }

  const eduLevel = input.education.level_normalized;
  if (eduLevel) {
    const eduMap: Record<EducationLevel, number> = {
      phd: 150,
      masters: 135,
      two_or_more_credentials: 128,
      bachelors: 120,
      two_year_post_secondary: 98,
      one_year_post_secondary: 84,
      secondary: 28,
      less_than_secondary: 0,
    };
    total += eduMap[eduLevel];
    basedOn.push("education");
  }

  const langLevel = input.language.self_assessed_level;
  const langMap: Record<typeof langLevel, number> = {
    native: 120,
    fluent: 108,
    advanced: 90,
    intermediate: 60,
    basic: 20,
  };
  total += langMap[langLevel];
  basedOn.push("self-assessed language proficiency");

  if (input.work.has_canadian_experience) {
    total += 40;
    basedOn.push("Canadian work experience");
  }

  const capped = Math.min(total, 1200);
  const low = Math.max(0, capped - 30);
  const high = Math.min(1200, capped + 30);

  return {
    low,
    high,
    midpoint: Math.round((low + high) / 2),
    basedOn,
    missingForExact,
  };
}

/**
 * Build the canonical PathwayInput JSON document from a voice session's
 * extracted profile. This is the only interface between the pre-pathway flow
 * and the pathway matching engine.
 */
export function buildPathwayInput(
  profileId: string,
  profile: Partial<VoiceExtractedProfile>,
  voiceSessionId: string | null,
  method: "voice" | "chat" | "form" = "voice"
): PathwayInput {
  const age = computeAge(profile.date_of_birth ?? null) ?? 0;
  const eduNormalized = normalizeEducationLevel(profile.education_level_voice ?? null);

  const spouseStatuses = ["married", "common_law", "common-law"];
  const hasSpouse = spouseStatuses.some((s) =>
    (profile.marital_status ?? "").toLowerCase().replace(/-/g, "_").includes(s.replace(/-/g, "_"))
  );

  const totalFields = 15;
  const collectedFields = [
    profile.full_name,
    profile.date_of_birth,
    profile.nationality,
    profile.current_country,
    profile.marital_status,
    profile.education_level_voice,
    profile.years_experience,
    profile.occupation,
    profile.language_proficiency_self,
    profile.annual_income,
    profile.income_currency,
    profile.has_canadian_experience !== undefined ? "set" : null,
    profile.has_family_in_canada !== undefined ? "set" : null,
    profile.intended_province !== undefined ? "set" : null,
    hasSpouse ? (profile.spouse_coming_to_canada !== undefined ? "set" : null) : "n/a",
  ].filter(Boolean).length;

  const input: PathwayInput = {
    profile_id: profileId,
    collected_at: new Date().toISOString(),
    schema_version: "1.0",

    personal: {
      age,
      date_of_birth: profile.date_of_birth ?? "",
      nationality: profile.nationality ?? "",
      current_country: profile.current_country ?? "",
      marital_status: normalizeMaritalStatus(profile.marital_status ?? null),
      spouse_accompanying: profile.spouse_coming_to_canada ?? false,
    },

    education: {
      level_self_reported: profile.education_level_voice ?? "",
      level_normalized: eduNormalized,
    },

    work: {
      occupation: profile.occupation ?? "",
      years_experience_total: profile.years_experience ?? 0,
      has_canadian_experience: profile.has_canadian_experience ?? false,
      noc_teer_inferred: inferNocTeer(profile.occupation ?? null, eduNormalized),
    },

    language: {
      primary_language: inferPrimaryLanguage(
        profile.occupation ?? null,
        profile.nationality ?? null
      ),
      self_assessed_level: profile.language_proficiency_self ?? "intermediate",
      clb_scores_available: false,
    },

    family: {
      has_family_in_canada: profile.has_family_in_canada ?? false,
      has_spouse_or_common_law: hasSpouse,
    },

    finances: {
      annual_income_original: profile.annual_income ?? 0,
      income_currency: profile.income_currency ?? "CAD",
      income_cad_estimate: null,
    },

    preferences: {
      destination_province: profile.intended_province ?? null,
    },

    crs_estimate: { range_low: 0, range_high: 0, confidence: "low", based_on: [], missing_for_exact: [] },

    data_completeness_pct: Math.round((collectedFields / totalFields) * 100),
    collection_method: method,
    voice_session_id: voiceSessionId,
  };

  const estimate = computeCrsEstimate(input);
  input.crs_estimate = {
    range_low: estimate.low,
    range_high: estimate.high,
    confidence: "low",
    based_on: estimate.basedOn,
    missing_for_exact: estimate.missingForExact,
  };

  return input;
}
