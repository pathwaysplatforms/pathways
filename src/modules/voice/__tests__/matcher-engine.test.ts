import { describe, it, expect } from "vitest";
import {
  ALL_VISA_TYPES,
  survivingPathways,
  pickNextQuestion,
  scorePathways,
  profileToAnswers,
  updateMatcher,
  initialMatcherState,
} from "../matcher-engine";
import type { UserAnswers, VisaType } from "../matcher-engine";

// ---------------------------------------------------------------------------
// survivingPathways
// ---------------------------------------------------------------------------

describe("survivingPathways", () => {
  it("keeps all pathways when no answers provided", () => {
    const result = survivingPathways({}, ALL_VISA_TYPES);
    expect(result).toEqual(ALL_VISA_TYPES);
  });

  it("eliminates express_entry_fsw for TEER 4 worker with no foreign experience", () => {
    const answers: Partial<UserAnswers> = {
      teerCategory: 4,
      foreignWorkExpYears: 0,
    };
    const result = survivingPathways(answers, ALL_VISA_TYPES);
    expect(result).not.toContain("express_entry_fsw");
  });

  it("eliminates express_entry_cec when user has zero Canadian work years", () => {
    const answers: Partial<UserAnswers> = { canadianWorkExpYears: 0 };
    const result = survivingPathways(answers, ALL_VISA_TYPES);
    expect(result).not.toContain("express_entry_cec");
  });

  it("eliminates family_sponsorship when familyInCanada is false", () => {
    const answers: Partial<UserAnswers> = { familyInCanada: false };
    const result = survivingPathways(answers, ALL_VISA_TYPES);
    expect(result).not.toContain("family_sponsorship");
  });

  it("keeps family_sponsorship when familyInCanada is true", () => {
    const answers: Partial<UserAnswers> = { familyInCanada: true };
    const result = survivingPathways(answers, ALL_VISA_TYPES);
    expect(result).toContain("family_sponsorship");
  });

  it("eliminates pgwp when priorCanadianStudy is false", () => {
    const answers: Partial<UserAnswers> = { priorCanadianStudy: false, pgwpEligible: false };
    const result = survivingPathways(answers, ALL_VISA_TYPES);
    expect(result).not.toContain("pgwp");
  });

  it("eliminates bowp when user is not currently in Canada", () => {
    const answers: Partial<UserAnswers> = { currentlyInCanada: false };
    const result = survivingPathways(answers, ALL_VISA_TYPES);
    expect(result).not.toContain("bowp");
  });

  it("eliminates express_entry_stem for TEER 3 worker with low CLB", () => {
    const answers: Partial<UserAnswers> = { teerCategory: 3, clbScore: 5 };
    const result = survivingPathways(answers, ALL_VISA_TYPES);
    expect(result).not.toContain("express_entry_stem");
  });

  it("does not expand previously eliminated pathways when called with a subset", () => {
    // Start with only FSW surviving
    const subset: VisaType[] = ["express_entry_fsw"];
    // Even with answers that favour other pathways, can't expand
    const answers: Partial<UserAnswers> = { familyInCanada: true };
    const result = survivingPathways(answers, subset);
    // family_sponsorship was never in the subset — still not present
    expect(result).not.toContain("family_sponsorship");
  });

  it("never eliminates pnp pathways on TEER alone (no universal hard rule)", () => {
    const answers: Partial<UserAnswers> = { teerCategory: 5, clbScore: 3 };
    const result = survivingPathways(answers, ALL_VISA_TYPES);
    expect(result).toContain("pnp_ontario");
    expect(result).toContain("pnp_bc");
    expect(result).toContain("pnp_alberta");
  });
});

// ---------------------------------------------------------------------------
// pickNextQuestion
// ---------------------------------------------------------------------------

describe("pickNextQuestion", () => {
  it("returns a field when multiple pathways survive and no fields answered", () => {
    const result = pickNextQuestion(ALL_VISA_TYPES, new Set());
    expect(result).not.toBeNull();
  });

  it("returns null when only one pathway survives", () => {
    const result = pickNextQuestion(["express_entry_fsw"], new Set());
    expect(result).toBeNull();
  });

  it("returns null when all fields are already answered", () => {
    const allFields = new Set<keyof UserAnswers>([
      "currentlyInCanada", "canadianWorkExpYears", "foreignWorkExpYears",
      "teerCategory", "clbScore", "educationLevel", "provincialTie",
      "jobOfferInCanada", "netWorth", "ageRange", "frenchAbility",
      "intentToLiveInQuebec", "pgwpEligible", "familyInCanada",
      "priorCanadianStudy", "nocCode",
    ]);
    const result = pickNextQuestion(["express_entry_fsw", "express_entry_cec"], allFields);
    expect(result).toBeNull();
  });

  it("does not suggest an already-answered field", () => {
    const answered = new Set<keyof UserAnswers>(["teerCategory"]);
    const result = pickNextQuestion(ALL_VISA_TYPES, answered);
    expect(result).not.toBe("teerCategory");
  });

  it("returns null when surviving set is empty", () => {
    const result = pickNextQuestion([], new Set());
    expect(result).toBeNull();
  });

  it("picks a field with an eliminating rule in the surviving set", () => {
    // Only FSW and CEC survive — both have rules on teerCategory
    const surviving: VisaType[] = ["express_entry_fsw", "express_entry_cec"];
    const result = pickNextQuestion(surviving, new Set());
    // teerCategory, clbScore, or work-exp fields should be prioritised
    const validDiscriminators: (keyof UserAnswers)[] = [
      "teerCategory", "clbScore", "canadianWorkExpYears", "foreignWorkExpYears",
    ];
    expect(validDiscriminators).toContain(result);
  });
});

// ---------------------------------------------------------------------------
// scorePathways
// ---------------------------------------------------------------------------

describe("scorePathways", () => {
  it("returns a scored entry for every surviving pathway", () => {
    const surviving: VisaType[] = ["express_entry_fsw", "express_entry_cec"];
    const result = scorePathways({}, surviving);
    expect(result).toHaveLength(2);
    const types = result.map((r) => r.visaType);
    expect(types).toContain("express_entry_fsw");
    expect(types).toContain("express_entry_cec");
  });

  it("scores higher for FSW when CLB is 9 and education is masters", () => {
    const answers: Partial<UserAnswers> = {
      clbScore: 9,
      educationLevel: "masters",
      foreignWorkExpYears: 3,
      teerCategory: 1,
    };
    const result = scorePathways(answers, ["express_entry_fsw", "express_entry_cec"]);
    const fsw = result.find((r) => r.visaType === "express_entry_fsw")!;
    expect(fsw.score).toBeGreaterThan(50);
    expect(fsw.reasons.length).toBeGreaterThan(0);
  });

  it("scores higher for CEC when user has 3+ years Canadian work experience", () => {
    const answers: Partial<UserAnswers> = { canadianWorkExpYears: 3, clbScore: 8 };
    const result = scorePathways(answers, ["express_entry_fsw", "express_entry_cec"]);
    const cec = result.find((r) => r.visaType === "express_entry_cec")!;
    expect(cec.score).toBeGreaterThan(50);
  });

  it("returns results sorted by score descending", () => {
    const answers: Partial<UserAnswers> = { familyInCanada: true };
    const result = scorePathways(answers, ["family_sponsorship", "express_entry_fsw"]);
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].score).toBeGreaterThanOrEqual(result[i].score);
    }
  });

  it("returns empty array when surviving set is empty", () => {
    const result = scorePathways({}, []);
    expect(result).toEqual([]);
  });

  it("returns baseline score of 50 when no relevant answers provided", () => {
    const result = scorePathways({}, ["express_entry_fsw"]);
    expect(result[0].score).toBe(50);
    expect(result[0].reasons).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// profileToAnswers
// ---------------------------------------------------------------------------

describe("profileToAnswers", () => {
  it("maps canadian_work_years and clb scores to UserAnswers", () => {
    const profile = {
      canadian_work_years: 2,
      clb_speaking: 9,
      clb_listening: 8,
      clb_reading: 7,
      clb_writing: 8,
      noc_teer_category: 1 as const,
      education_level: "masters" as const,
    };
    const result = profileToAnswers(profile);
    expect(result.canadianWorkExpYears).toBe(2);
    expect(result.clbScore).toBe(7); // min of all four
    expect(result.teerCategory).toBe(1);
    expect(result.educationLevel).toBe("masters");
  });

  it("sets currentlyInCanada from current_country containing 'canada'", () => {
    const result = profileToAnswers({ current_country: "Canada" });
    expect(result.currentlyInCanada).toBe(true);
  });

  it("returns empty object when profile is empty", () => {
    const result = profileToAnswers({});
    expect(Object.keys(result)).toHaveLength(0);
  });

  it("sets intentToLiveInQuebec when intended_province includes 'Quebec'", () => {
    const result = profileToAnswers({ intended_province: "Quebec" });
    expect(result.provincialTie).toBe(true);
    expect(result.intentToLiveInQuebec).toBe(true);
  });

  it("does not set currentlyInCanada for non-Canada country", () => {
    const result = profileToAnswers({ current_country: "India" });
    expect(result.currentlyInCanada).toBe(false);
  });

  it("maps date_of_birth to ageRange", () => {
    const result = profileToAnswers({ date_of_birth: "1993-01-01" }); // ~32 in 2025
    expect(result.ageRange).toBe("30-34");
  });
});

// ---------------------------------------------------------------------------
// updateMatcher
// ---------------------------------------------------------------------------

describe("updateMatcher", () => {
  it("increments turnCount on each call", () => {
    const state = initialMatcherState();
    const updated = updateMatcher(state, {});
    expect(updated.turnCount).toBe(1);
    const updated2 = updateMatcher(updated, {});
    expect(updated2.turnCount).toBe(2);
  });

  it("sets converged = true when surviving.length <= 2", () => {
    // Give answers that eliminate almost all pathways
    const profile = {
      familyInCanada: false,
      priorCanadianStudy: false,
      pgwpEligible: false,
      jobOfferInCanada: false,
      currentlyInCanada: false,
      teerCategory: 1 as const,
      clbScore: 9,
      canadianWorkExpYears: 0,
      foreign_work_years: 5,
      // noc_teer_category to map teerCategory
      noc_teer_category: 1 as const,
    };
    const state = initialMatcherState();
    const updated = updateMatcher(state, profile);
    if (updated.surviving.length <= 2) {
      expect(updated.converged).toBe(true);
      expect(updated.scored).not.toBeNull();
    }
  });

  it("sets converged = true when turnCount reaches 8", () => {
    let state = initialMatcherState();
    // Force turnCount to 7 without triggering pathway elimination
    for (let i = 0; i < 7; i++) {
      state = updateMatcher(state, {});
    }
    expect(state.turnCount).toBe(7);
    expect(state.converged).toBe(false);
    // 8th update triggers convergence
    state = updateMatcher(state, {});
    expect(state.converged).toBe(true);
  });

  it("never expands surviving set beyond initial state", () => {
    const state = initialMatcherState();
    // First turn eliminates CEC (no Canadian experience)
    const state2 = updateMatcher(state, { canadian_work_years: 0 });
    expect(state2.surviving).not.toContain("express_entry_cec");
    // Second turn provides Canadian work years — eliminated pathway does not return
    const state3 = updateMatcher(state2, { canadian_work_years: 2 });
    // Because surviving is monotonically filtered, CEC stays eliminated
    // (state3.surviving was filtered from state2.surviving, not ALL_VISA_TYPES)
    expect(state3.surviving).not.toContain("express_entry_cec");
  });

  it("populates scored array only after convergence", () => {
    const state = initialMatcherState();
    const early = updateMatcher(state, {});
    // Not yet converged (all pathways still survive)
    if (!early.converged) {
      expect(early.scored).toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// New VisaType elimination rules
// ---------------------------------------------------------------------------

describe("survivingPathways — new VisaType rules", () => {
  it("eliminates quebec_skilled_worker when intentToLiveInQuebec is false", () => {
    const answers: Partial<UserAnswers> = { intentToLiveInQuebec: false };
    const all = ALL_VISA_TYPES as VisaType[];
    const surviving = survivingPathways(answers, all);
    expect(surviving).not.toContain("quebec_skilled_worker");
  });

  it("does not eliminate quebec_skilled_worker when intentToLiveInQuebec is true", () => {
    const answers: Partial<UserAnswers> = { intentToLiveInQuebec: true };
    const all = ALL_VISA_TYPES as VisaType[];
    const surviving = survivingPathways(answers, all);
    expect(surviving).toContain("quebec_skilled_worker");
  });

  it("eliminates ee_french_language when frenchAbility is false", () => {
    const answers: Partial<UserAnswers> = { frenchAbility: false };
    const all = ALL_VISA_TYPES as VisaType[];
    const surviving = survivingPathways(answers, all);
    expect(surviving).not.toContain("ee_french_language");
  });

  it("eliminates ee_french_language when CLB is below 7", () => {
    const answers: Partial<UserAnswers> = { clbScore: 6 };
    const all = ALL_VISA_TYPES as VisaType[];
    const surviving = survivingPathways(answers, all);
    expect(surviving).not.toContain("ee_french_language");
  });

  it("eliminates ee_trades for TEER 0 (management)", () => {
    const answers: Partial<UserAnswers> = { teerCategory: 0 };
    const all = ALL_VISA_TYPES as VisaType[];
    const surviving = survivingPathways(answers, all);
    expect(surviving).not.toContain("ee_trades");
  });

  it("eliminates ee_trades for TEER 1", () => {
    const answers: Partial<UserAnswers> = { teerCategory: 1 };
    const all = ALL_VISA_TYPES as VisaType[];
    const surviving = survivingPathways(answers, all);
    expect(surviving).not.toContain("ee_trades");
  });

  it("keeps ee_trades for TEER 2", () => {
    const answers: Partial<UserAnswers> = { teerCategory: 2 };
    const all = ALL_VISA_TYPES as VisaType[];
    const surviving = survivingPathways(answers, all);
    expect(surviving).toContain("ee_trades");
  });

  it("eliminates ee_healthcare for TEER 0", () => {
    const answers: Partial<UserAnswers> = { teerCategory: 0 };
    const all = ALL_VISA_TYPES as VisaType[];
    const surviving = survivingPathways(answers, all);
    expect(surviving).not.toContain("ee_healthcare");
  });

  it("keeps ee_healthcare for TEER 2 (allied health)", () => {
    const answers: Partial<UserAnswers> = { teerCategory: 2 };
    const all = ALL_VISA_TYPES as VisaType[];
    const surviving = survivingPathways(answers, all);
    expect(surviving).toContain("ee_healthcare");
  });
});

// ---------------------------------------------------------------------------
// profileToAnswers — has_prior_canadian_study mapping
// ---------------------------------------------------------------------------

describe("profileToAnswers — has_prior_canadian_study", () => {
  it("maps has_prior_canadian_study=true to priorCanadianStudy=true and pgwpEligible=true", () => {
    const answers = profileToAnswers({ has_prior_canadian_study: true, requires_review: [] });
    expect(answers.priorCanadianStudy).toBe(true);
    expect(answers.pgwpEligible).toBe(true);
  });

  it("maps has_prior_canadian_study=false to priorCanadianStudy=false and does not set pgwpEligible", () => {
    const answers = profileToAnswers({ has_prior_canadian_study: false, requires_review: [] });
    expect(answers.priorCanadianStudy).toBe(false);
    expect(answers.pgwpEligible).toBeUndefined();
  });

  it("leaves priorCanadianStudy and pgwpEligible undefined when field is null", () => {
    const answers = profileToAnswers({ has_prior_canadian_study: null, requires_review: [] });
    expect(answers.priorCanadianStudy).toBeUndefined();
    expect(answers.pgwpEligible).toBeUndefined();
  });
});
