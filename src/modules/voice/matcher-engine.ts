import type { PartialExtractedProfile } from "./types";

/** All active Canadian visa_type slugs from immigration_chunks / extractor.py CANADA_VISA_TYPE_MAP. */
export type VisaType =
  | "express_entry_fsw"
  | "express_entry_cec"
  | "express_entry_fst"
  | "express_entry_stem"
  | "pnp_ontario"
  | "pnp_bc"
  | "pnp_alberta"
  | "family_sponsorship"
  | "pgwp"
  | "atlantic_immigration"
  | "startup_visa"
  | "rural_northern_immigration"
  | "caregiver"
  | "bowp";

export const ALL_VISA_TYPES: VisaType[] = [
  "express_entry_fsw",
  "express_entry_cec",
  "express_entry_fst",
  "express_entry_stem",
  "pnp_ontario",
  "pnp_bc",
  "pnp_alberta",
  "family_sponsorship",
  "pgwp",
  "atlantic_immigration",
  "startup_visa",
  "rural_northern_immigration",
  "caregiver",
  "bowp",
];

/** High-signal fields the Akinator matcher uses to eliminate pathways. */
export interface UserAnswers {
  /** Whether the user currently lives/works in Canada. */
  currentlyInCanada: boolean;
  /** Years of skilled work experience inside Canada. */
  canadianWorkExpYears: number;
  /** Years of skilled work experience outside Canada. */
  foreignWorkExpYears: number;
  /** NOC TEER category inferred from occupation (0–5). */
  teerCategory: 0 | 1 | 2 | 3 | 4 | 5;
  /** Lowest CLB score across all four language abilities. */
  clbScore: number;
  /** Highest education level achieved. */
  educationLevel:
    | "less_than_secondary"
    | "secondary"
    | "one_year_post_secondary"
    | "two_year_post_secondary"
    | "bachelors"
    | "two_or_more_credentials"
    | "masters"
    | "phd";
  /** Whether the user has a named province preference or provincial nomination. */
  provincialTie: boolean;
  /** Whether the user has a valid job offer from a Canadian employer. */
  jobOfferInCanada: boolean;
  /** Estimated net worth in CAD (relevant for startup_visa; never collected by voice). */
  netWorth: number;
  /** Binned age range string matching CRS age brackets. */
  ageRange: "under-18" | "18-29" | "30-34" | "35-39" | "40-44" | "45+";
  /** Whether the user can speak/read French at CLB 5+. */
  frenchAbility: boolean;
  /** Whether the user specifically intends to live in Quebec. */
  intentToLiveInQuebec: boolean;
  /** Whether the user is eligible for a PGWP (studied full-time at a DLI in Canada). */
  pgwpEligible: boolean;
  /** Whether the user has a family member in Canada. */
  familyInCanada: boolean;
  /** Whether the user previously studied in Canada. */
  priorCanadianStudy: boolean;
  /** NOC occupation code (6 digits). Rarely populated by voice. */
  nocCode: string;
}

/** A single hard eligibility rule for one pathway. */
export interface PathwayRule {
  field: keyof UserAnswers;
  /** Comparison operator applied as: answers[field] {operator} value */
  operator: "eq" | "gte" | "lte" | "in" | "exists";
  value: unknown;
  /**
   * When true: if the condition is met, the pathway is eliminated.
   * Rule fires only when the field value is known (not undefined).
   */
  eliminates: boolean;
}

export interface ScoredPathway {
  visaType: VisaType;
  score: number;
  reasons: string[];
}

export interface MatcherState {
  answers: Partial<UserAnswers>;
  surviving: VisaType[];
  turnCount: number;
  converged: boolean;
  scored: ScoredPathway[] | null;
}

// ---------------------------------------------------------------------------
// Hard elimination rules
// Rules fire ONLY when the relevant field is known (not undefined).
// `eliminates: true` means: condition met → pathway eliminated.
// ---------------------------------------------------------------------------

export const PATHWAY_RULES: Record<VisaType, PathwayRule[]> = {
  // Federal Skilled Worker: TEER 0-3, CLB 7+, ≥1 yr foreign skilled work, post-secondary
  express_entry_fsw: [
    { field: "teerCategory", operator: "in", value: [4, 5], eliminates: true },
    { field: "clbScore", operator: "lte", value: 6, eliminates: true },
    { field: "foreignWorkExpYears", operator: "lte", value: 0, eliminates: true },
  ],

  // Canadian Experience Class: TEER 0-3, CLB 7+, ≥1 yr Canadian work
  express_entry_cec: [
    { field: "teerCategory", operator: "in", value: [4, 5], eliminates: true },
    { field: "canadianWorkExpYears", operator: "lte", value: 0, eliminates: true },
    { field: "clbScore", operator: "lte", value: 4, eliminates: true },
  ],

  // Federal Skilled Trades: TEER 2-3 only, CLB 5+, ≥2 yr trades experience
  express_entry_fst: [
    { field: "teerCategory", operator: "in", value: [0, 1, 4, 5], eliminates: true },
    { field: "clbScore", operator: "lte", value: 4, eliminates: true },
  ],

  // Express Entry STEM draw: TEER 0-1 STEM, CLB 7+
  express_entry_stem: [
    { field: "teerCategory", operator: "in", value: [2, 3, 4, 5], eliminates: true },
    { field: "clbScore", operator: "lte", value: 6, eliminates: true },
  ],

  // Ontario PNP: many streams, no universal hard eliminator from voice fields
  pnp_ontario: [],

  // BC PNP: many streams, no universal hard eliminator from voice fields
  pnp_bc: [],

  // Alberta AAIP: many streams, no universal hard eliminator from voice fields
  pnp_alberta: [],

  // Family Sponsorship: must have a qualifying family member in Canada
  family_sponsorship: [
    { field: "familyInCanada", operator: "eq", value: false, eliminates: true },
  ],

  // Post-Graduation Work Permit: must have studied full-time at a DLI in Canada
  pgwp: [
    { field: "priorCanadianStudy", operator: "eq", value: false, eliminates: true },
    { field: "pgwpEligible", operator: "eq", value: false, eliminates: true },
  ],

  // Atlantic Immigration Program: job offer from Atlantic employer, TEER 0-3
  atlantic_immigration: [
    { field: "jobOfferInCanada", operator: "eq", value: false, eliminates: true },
    { field: "teerCategory", operator: "in", value: [4, 5], eliminates: true },
  ],

  // Start-up Visa: CLB 5+; netWorth not asked by voice so no netWorth rule here
  startup_visa: [
    { field: "clbScore", operator: "lte", value: 4, eliminates: true },
  ],

  // Rural and Northern Immigration Pilot: job offer in a participating community
  rural_northern_immigration: [
    { field: "jobOfferInCanada", operator: "eq", value: false, eliminates: true },
  ],

  // Caregiver Pilots: TEER 3-4 occupations, CLB 5+
  caregiver: [
    { field: "teerCategory", operator: "in", value: [0, 1, 2, 5], eliminates: true },
    { field: "clbScore", operator: "lte", value: 4, eliminates: true },
  ],

  // Bridging Open Work Permit: must currently be in Canada on a valid work permit
  bowp: [
    { field: "currentlyInCanada", operator: "eq", value: false, eliminates: true },
    { field: "canadianWorkExpYears", operator: "lte", value: 0, eliminates: true },
  ],
};

// ---------------------------------------------------------------------------
// Rule evaluation (pure)
// ---------------------------------------------------------------------------

/** Returns true when the rule's condition is satisfied for the given answers. */
function evaluateRule(answers: Partial<UserAnswers>, rule: PathwayRule): boolean {
  const val = answers[rule.field];
  if (val === undefined) return false; // unknown field → never eliminate on uncertainty

  switch (rule.operator) {
    case "eq":
      return val === rule.value;
    case "gte":
      return (val as number) >= (rule.value as number);
    case "lte":
      return (val as number) <= (rule.value as number);
    case "in":
      return (rule.value as unknown[]).includes(val);
    case "exists":
      return val !== null && val !== undefined;
  }
}

// ---------------------------------------------------------------------------
// Public API — all pure functions, no side effects
// ---------------------------------------------------------------------------

/**
 * Filter the candidate list down to pathways not eliminated by the current answers.
 * Pass the previous surviving set (not ALL_VISA_TYPES) to ensure monotonic filtering.
 */
export function survivingPathways(
  answers: Partial<UserAnswers>,
  all: VisaType[]
): VisaType[] {
  return all.filter((visaType) => {
    const rules = PATHWAY_RULES[visaType];
    return !rules.some((rule) => rule.eliminates && evaluateRule(answers, rule));
  });
}

/**
 * Return the unasked field whose answer would split the surviving set most evenly.
 * "Most evenly" = minimises |eliminate_count − keep_count| across surviving pathways.
 * Returns null when surviving.length <= 1 or all fields answered.
 */
export function pickNextQuestion(
  surviving: VisaType[],
  answered: Set<keyof UserAnswers>
): keyof UserAnswers | null {
  if (surviving.length <= 1) return null;

  // Priority order: most discriminating fields first as a tiebreaker
  const fieldOrder: (keyof UserAnswers)[] = [
    "teerCategory",
    "clbScore",
    "canadianWorkExpYears",
    "foreignWorkExpYears",
    "familyInCanada",
    "jobOfferInCanada",
    "priorCanadianStudy",
    "currentlyInCanada",
    "educationLevel",
    "provincialTie",
    "intentToLiveInQuebec",
    "pgwpEligible",
    "ageRange",
    "frenchAbility",
    "netWorth",
    "nocCode",
  ];

  const unanswered = fieldOrder.filter((f) => !answered.has(f));
  if (unanswered.length === 0) return null;

  let bestField: keyof UserAnswers | null = null;
  let bestImbalance = Infinity;

  for (const field of unanswered) {
    // Count how many surviving pathways have an eliminating rule on this field
    const withEliminatingRule = surviving.filter((vt) =>
      PATHWAY_RULES[vt].some((r) => r.field === field && r.eliminates)
    ).length;
    const without = surviving.length - withEliminatingRule;
    const imbalance = Math.abs(withEliminatingRule - without);

    // Prefer fields that would eliminate at least one pathway
    if (withEliminatingRule > 0 && imbalance < bestImbalance) {
      bestImbalance = imbalance;
      bestField = field;
    }
  }

  // Fall back to first unanswered field if no eliminating rule found
  return bestField ?? unanswered[0] ?? null;
}

/**
 * Soft-rank the surviving pathways by how well the known answers favour each one.
 * Returns all surviving pathways sorted by score descending.
 */
export function scorePathways(
  answers: Partial<UserAnswers>,
  surviving: VisaType[]
): ScoredPathway[] {
  const results: ScoredPathway[] = surviving.map((visaType) => {
    let score = 50;
    const reasons: string[] = [];

    const clb = answers.clbScore;
    const canWork = answers.canadianWorkExpYears ?? 0;
    const foreignWork = answers.foreignWorkExpYears ?? 0;
    const edu = answers.educationLevel;
    const teer = answers.teerCategory;

    switch (visaType) {
      case "express_entry_fsw":
        if (clb != null && clb >= 9) { score += 20; reasons.push("Strong CLB (9+)"); }
        else if (clb != null && clb >= 7) { score += 10; reasons.push("CLB meets minimum"); }
        if (edu && ["masters", "phd"].includes(edu)) { score += 15; reasons.push("Graduate education"); }
        else if (edu && ["bachelors", "two_or_more_credentials"].includes(edu)) { score += 8; reasons.push("Post-secondary degree"); }
        if (foreignWork >= 3) { score += 12; reasons.push("3+ yrs foreign experience"); }
        else if (foreignWork >= 1) { score += 6; reasons.push("Eligible work experience"); }
        if (teer != null && teer <= 1) { score += 10; reasons.push("High-skilled occupation (TEER 0–1)"); }
        break;

      case "express_entry_cec":
        if (canWork >= 3) { score += 25; reasons.push("3+ yrs Canadian experience"); }
        else if (canWork >= 1) { score += 15; reasons.push("Canadian experience qualifies"); }
        if (clb != null && clb >= 8) { score += 15; reasons.push("Strong CLB score"); }
        if (teer != null && teer <= 1) { score += 10; reasons.push("High-skilled occupation"); }
        break;

      case "express_entry_fst":
        if (teer === 2 || teer === 3) { score += 20; reasons.push("Trades-eligible TEER 2/3"); }
        if (foreignWork + canWork >= 2) { score += 15; reasons.push("2+ yrs trades experience"); }
        if (clb != null && clb >= 5) { score += 10; reasons.push("Language meets threshold"); }
        break;

      case "express_entry_stem":
        if (teer != null && teer <= 1) { score += 25; reasons.push("STEM-eligible TEER 0/1"); }
        if (clb != null && clb >= 9) { score += 15; reasons.push("Strong CLB for STEM draw"); }
        if (edu && ["masters", "phd"].includes(edu)) { score += 10; reasons.push("Graduate STEM credential"); }
        break;

      case "pnp_ontario":
        if (answers.provincialTie && answers.intentToLiveInQuebec === false) { score += 20; reasons.push("Provincial connection"); }
        if (canWork >= 1) { score += 10; reasons.push("Ontario work history valued"); }
        break;

      case "pnp_bc":
        if (answers.provincialTie && answers.intentToLiveInQuebec === false) { score += 20; reasons.push("Provincial connection"); }
        if (teer != null && teer <= 2) { score += 10; reasons.push("Skilled occupation for BC"); }
        break;

      case "pnp_alberta":
        if (answers.provincialTie && answers.intentToLiveInQuebec === false) { score += 20; reasons.push("Provincial connection"); }
        if (teer != null && teer <= 3) { score += 10; reasons.push("Eligible occupation"); }
        break;

      case "family_sponsorship":
        if (answers.familyInCanada) { score += 40; reasons.push("Family member in Canada"); }
        break;

      case "pgwp":
        if (answers.pgwpEligible) { score += 40; reasons.push("PGWP eligible"); }
        if (answers.priorCanadianStudy) { score += 20; reasons.push("Studied in Canada"); }
        break;

      case "atlantic_immigration":
        if (answers.jobOfferInCanada) { score += 30; reasons.push("Job offer in hand"); }
        if (teer != null && teer <= 2) { score += 10; reasons.push("Skilled occupation for AIP"); }
        break;

      case "startup_visa":
        if (clb != null && clb >= 7) { score += 15; reasons.push("Language exceeds minimum"); }
        if (edu && ["masters", "phd"].includes(edu)) { score += 15; reasons.push("Advanced qualification for entrepreneurship"); }
        if (teer != null && teer <= 1) { score += 10; reasons.push("Professional background"); }
        break;

      case "rural_northern_immigration":
        if (answers.jobOfferInCanada) { score += 30; reasons.push("Job offer in hand"); }
        if (teer != null && teer <= 3) { score += 10; reasons.push("Eligible occupation for RNIP"); }
        break;

      case "caregiver":
        if (teer === 3 || teer === 4) { score += 20; reasons.push("Caregiver-eligible TEER 3/4"); }
        if (clb != null && clb >= 5) { score += 10; reasons.push("Language meets minimum"); }
        break;

      case "bowp":
        if (answers.currentlyInCanada) { score += 30; reasons.push("Currently in Canada"); }
        if (canWork >= 1) { score += 20; reasons.push("Existing Canadian work history"); }
        break;
    }

    return { visaType, score, reasons };
  });

  return results.sort((a, b) => b.score - a.score);
}

// ---------------------------------------------------------------------------
// Profile → UserAnswers mapping (bridges voice profile fields to matcher fields)
// ---------------------------------------------------------------------------

function ageToRange(dateOfBirth: string): UserAnswers["ageRange"] | null {
  const dob = new Date(dateOfBirth);
  if (isNaN(dob.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  if (age < 18) return "under-18";
  if (age <= 29) return "18-29";
  if (age <= 34) return "30-34";
  if (age <= 39) return "35-39";
  if (age <= 44) return "40-44";
  return "45+";
}

/** Derive a Partial<UserAnswers> from the accumulated voice profile. */
export function profileToAnswers(profile: PartialExtractedProfile): Partial<UserAnswers> {
  const answers: Partial<UserAnswers> = {};

  if (profile.current_country != null) {
    answers.currentlyInCanada = /canada/i.test(profile.current_country);
  } else if (profile.canadian_work_years != null && profile.canadian_work_years > 0) {
    answers.currentlyInCanada = true;
  }

  if (profile.canadian_work_years != null) {
    answers.canadianWorkExpYears = profile.canadian_work_years;
  }

  if (profile.foreign_work_years != null) {
    answers.foreignWorkExpYears = profile.foreign_work_years;
  }

  if (profile.noc_teer_category != null) {
    answers.teerCategory = profile.noc_teer_category as UserAnswers["teerCategory"];
  }

  const clbs = (
    [profile.clb_speaking, profile.clb_listening, profile.clb_reading, profile.clb_writing] as (number | null | undefined)[]
  ).filter((v): v is number => v != null);
  if (clbs.length > 0) {
    answers.clbScore = Math.min(...clbs);
  }

  if (profile.education_level != null) {
    answers.educationLevel = profile.education_level;
  }

  if (profile.intended_province != null) {
    answers.provincialTie = true;
    const prov = profile.intended_province.toLowerCase();
    answers.intentToLiveInQuebec = prov.includes("quebec") || prov.includes("québec") || prov === "qc";
  } else if (profile.has_provincial_nomination != null) {
    answers.provincialTie = profile.has_provincial_nomination;
  }

  if (profile.has_canadian_job_offer != null) {
    answers.jobOfferInCanada = profile.has_canadian_job_offer;
  }

  if (profile.has_family_in_canada != null) {
    answers.familyInCanada = profile.has_family_in_canada;
  }

  if (profile.noc_code != null) {
    answers.nocCode = profile.noc_code;
  }

  if (profile.date_of_birth != null) {
    const range = ageToRange(profile.date_of_birth);
    if (range) answers.ageRange = range;
  }

  // ageRange 45+ is a soft CRS signal but not a hard eliminator
  if (answers.ageRange === "45+") {
    // No pathway eliminates based on age alone — no rule to set
  }

  return answers;
}

// ---------------------------------------------------------------------------
// State helpers
// ---------------------------------------------------------------------------

/** Return the initial matcher state with all pathways surviving. */
export function initialMatcherState(): MatcherState {
  return {
    answers: {},
    surviving: [...ALL_VISA_TYPES],
    turnCount: 0,
    converged: false,
    scored: null,
  };
}

/**
 * Update matcher state from the latest accumulated profile.
 * Re-derives answers from the full profile each turn so state is always consistent
 * with accumulated extracted_data (no risk of delta-only drift).
 */
export function updateMatcher(
  state: MatcherState,
  updatedProfile: PartialExtractedProfile
): MatcherState {
  const newAnswers = profileToAnswers(updatedProfile);
  // Only filter down from the previous surviving set — never re-expand
  const newSurviving = survivingPathways(newAnswers, state.surviving);
  const newTurnCount = state.turnCount + 1;
  const converged = newSurviving.length <= 2 || newTurnCount >= 8;
  const scored = converged ? scorePathways(newAnswers, newSurviving) : state.scored;

  return {
    answers: newAnswers,
    surviving: newSurviving,
    turnCount: newTurnCount,
    converged,
    scored,
  };
}
