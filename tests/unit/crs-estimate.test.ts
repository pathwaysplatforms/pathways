import { describe, it, expect } from "vitest";
import { computeCrsEstimate, computeClbPlusOneDelta, crsFactorCaps, type CrsInput } from "@/lib/crs-estimate";

// Expected values come from the official IRCC CRS grid:
// https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/check-score/crs-criteria.html

/** ISO date of birth for someone who turned `years` about a month ago. */
function dobForAge(years: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

const clb = (level: number) => ({
  clb_speaking: level, clb_listening: level, clb_reading: level, clb_writing: level,
});

const spouseClb = (level: number) => ({
  spouse_clb_speaking: level, spouse_clb_listening: level, spouse_clb_reading: level, spouse_clb_writing: level,
});

const BASE_PROFILE: CrsInput = {
  date_of_birth: dobForAge(30),
  education_level: "bachelors",
  ...clb(9),
  canadian_work_years: 2,
  nationality: "Indian",
  requires_review: [],
};

const WITH_SPOUSE: CrsInput = { ...BASE_PROFILE, spouse_coming_to_canada: true };

describe("computeCrsEstimate", () => {
  describe("returns null when insufficient data", () => {
    it("returns null for empty profile", () => {
      expect(computeCrsEstimate({})).toBeNull();
    });

    it("returns null for fewer than 3 scoreable fields", () => {
      expect(computeCrsEstimate({ date_of_birth: "1990-01-01", education_level: "bachelors" })).toBeNull();
    });

    it("returns an estimate when at least 3 fields are present", () => {
      const result = computeCrsEstimate({
        date_of_birth: "1990-01-01",
        education_level: "bachelors",
        clb_speaking: 9,
        requires_review: [],
      });
      expect(result).not.toBeNull();
    });
  });

  describe("age", () => {
    it("scores 110 for a single applicant aged 25 and 100 with an accompanying spouse", () => {
      expect(computeCrsEstimate({ ...BASE_PROFILE, date_of_birth: dobForAge(25) })?.breakdown.age).toBe(110);
      expect(computeCrsEstimate({ ...WITH_SPOUSE, date_of_birth: dobForAge(25) })?.breakdown.age).toBe(100);
    });

    it("declines year by year after 30 (age 36: 72 single, 65 with spouse)", () => {
      expect(computeCrsEstimate({ ...BASE_PROFILE, date_of_birth: dobForAge(36) })?.breakdown.age).toBe(72);
      expect(computeCrsEstimate({ ...WITH_SPOUSE, date_of_birth: dobForAge(36) })?.breakdown.age).toBe(65);
    });

    it("scores 0 at 17 and at 45", () => {
      expect(computeCrsEstimate({ ...BASE_PROFILE, date_of_birth: dobForAge(17) })?.breakdown.age).toBe(0);
      expect(computeCrsEstimate({ ...BASE_PROFILE, date_of_birth: dobForAge(45) })?.breakdown.age).toBe(0);
    });
  });

  describe("education", () => {
    it("scores 150 for a PhD and 120 for a bachelor's (single)", () => {
      expect(computeCrsEstimate({ ...BASE_PROFILE, education_level: "phd" })?.breakdown.education).toBe(150);
      expect(computeCrsEstimate(BASE_PROFILE)?.breakdown.education).toBe(120);
    });

    it("scores 112 for a bachelor's with an accompanying spouse", () => {
      expect(computeCrsEstimate(WITH_SPOUSE)?.breakdown.education).toBe(112);
    });

    it("keeps education points and flags ecaPending when no ECA has been obtained", () => {
      const result = computeCrsEstimate({ ...BASE_PROFILE, eca_obtained: false });
      expect(result?.breakdown.education).toBe(120);
      expect(result?.ecaPending).toBe(true);
    });

    it("does not flag ecaPending when the ECA is obtained or its status is unknown", () => {
      expect(computeCrsEstimate({ ...BASE_PROFILE, eca_obtained: true })?.ecaPending).toBe(false);
      expect(computeCrsEstimate(BASE_PROFILE)?.ecaPending).toBe(false);
    });

    it("does not flag ecaPending when no education points are claimed", () => {
      const result = computeCrsEstimate({ ...BASE_PROFILE, education_level: "less_than_secondary", eca_obtained: false });
      expect(result?.ecaPending).toBe(false);
    });
  });

  describe("first official language", () => {
    it("scores 136 for CLB 10, 124 for CLB 9 and 68 for CLB 7 (single)", () => {
      expect(computeCrsEstimate({ ...BASE_PROFILE, ...clb(10) })?.breakdown.language).toBe(136);
      expect(computeCrsEstimate(BASE_PROFILE)?.breakdown.language).toBe(124);
      expect(computeCrsEstimate({ ...BASE_PROFILE, ...clb(7) })?.breakdown.language).toBe(68);
    });

    it("scores 116 for CLB 9 with an accompanying spouse", () => {
      expect(computeCrsEstimate(WITH_SPOUSE)?.breakdown.language).toBe(116);
    });

    it("scores a self-assessed level as its assumed CLB when no test scores exist", () => {
      const { clb_speaking, clb_listening, clb_reading, clb_writing, ...withoutClb } = BASE_PROFILE;
      void clb_speaking; void clb_listening; void clb_reading; void clb_writing;
      const result = computeCrsEstimate({ ...withoutClb, language_proficiency_self: "fluent" });
      expect(result?.breakdown.language).toBe(124);
    });

    it("counts missing abilities as 0 once any test score exists", () => {
      const result = computeCrsEstimate({
        date_of_birth: dobForAge(30),
        education_level: "bachelors",
        clb_speaking: 9,
        requires_review: [],
      });
      expect(result?.breakdown.language).toBe(31);
    });
  });

  describe("Canadian work experience", () => {
    it("scores 40 for 1 year and 80 for 5+ years (single)", () => {
      expect(computeCrsEstimate({ ...BASE_PROFILE, canadian_work_years: 1 })?.breakdown.experience).toBe(40);
      expect(computeCrsEstimate({ ...BASE_PROFILE, canadian_work_years: 7 })?.breakdown.experience).toBe(80);
    });

    it("scores 46 for 2 years with an accompanying spouse", () => {
      expect(computeCrsEstimate(WITH_SPOUSE)?.breakdown.experience).toBe(46);
    });

    it("returns 0 for TEER 4 and TEER 5 occupations", () => {
      expect(computeCrsEstimate({ ...BASE_PROFILE, noc_teer_category: 4 })?.breakdown.experience).toBe(0);
      expect(computeCrsEstimate({ ...BASE_PROFILE, noc_teer_category: 5 })?.breakdown.experience).toBe(0);
    });

    it("counts a bare has_canadian_experience answer as one year", () => {
      const { canadian_work_years, ...withoutYears } = BASE_PROFILE;
      void canadian_work_years;
      const result = computeCrsEstimate({ ...withoutYears, has_canadian_experience: true });
      expect(result?.breakdown.experience).toBe(40);
    });

    it("does not treat total years of experience as Canadian experience", () => {
      const { canadian_work_years, ...withoutYears } = BASE_PROFILE;
      void canadian_work_years;
      const result = computeCrsEstimate({ ...withoutYears, years_experience: 6 });
      expect(result?.breakdown.experience).toBe(0);
    });
  });

  describe("spouse factors", () => {
    it("scores education, language and Canadian work for an accompanying spouse", () => {
      const result = computeCrsEstimate({
        ...WITH_SPOUSE,
        spouse_education_level: "masters",
        ...spouseClb(9),
        spouse_canadian_work_years: 2,
      });
      expect(result?.withSpouse).toBe(true);
      expect(result?.breakdown.spouse).toBe(10 + 20 + 7);
    });

    it("caps spouse factors at 40", () => {
      const result = computeCrsEstimate({
        ...WITH_SPOUSE,
        spouse_education_level: "phd",
        ...spouseClb(10),
        spouse_canadian_work_years: 6,
      });
      expect(result?.breakdown.spouse).toBe(40);
    });

    it("ignores spouse details and uses single columns when the spouse is not coming", () => {
      const result = computeCrsEstimate({
        ...BASE_PROFILE,
        spouse_coming_to_canada: false,
        spouse_education_level: "masters",
        ...spouseClb(9),
      });
      expect(result?.withSpouse).toBe(false);
      expect(result?.breakdown.spouse).toBe(0);
      expect(result?.breakdown.education).toBe(120);
    });
  });

  describe("skill transferability", () => {
    it("scores 13 for one post-secondary credential with CLB 7–8 and no work experience", () => {
      const result = computeCrsEstimate({ ...BASE_PROFILE, ...clb(7), canadian_work_years: 0 });
      expect(result?.breakdown.transferability).toBe(13);
    });

    it("caps the education group at 50 (master's, CLB 9, 1 year Canadian work)", () => {
      const result = computeCrsEstimate({ ...BASE_PROFILE, education_level: "masters", canadian_work_years: 1 });
      expect(result?.breakdown.transferability).toBe(50);
    });

    it("scores 13 for 1–2 years of foreign work with CLB 7–8", () => {
      const result = computeCrsEstimate({
        ...BASE_PROFILE,
        education_level: "less_than_secondary",
        ...clb(8),
        canadian_work_years: 0,
        foreign_work_years: 2,
        foreign_work_recent: true,
      });
      expect(result?.breakdown.transferability).toBe(13);
    });

    it("excludes foreign work flagged as not recent", () => {
      const result = computeCrsEstimate({
        ...BASE_PROFILE,
        education_level: "less_than_secondary",
        ...clb(8),
        canadian_work_years: 0,
        foreign_work_years: 2,
        foreign_work_recent: false,
      });
      expect(result?.breakdown.transferability).toBe(0);
    });

    it("caps total transferability at 100", () => {
      const result = computeCrsEstimate({ ...BASE_PROFILE, foreign_work_years: 3, foreign_work_recent: true });
      expect(result?.breakdown.transferability).toBe(100);
    });
  });

  describe("additional points", () => {
    it("adds 600 for a provincial nomination and 15 for a sibling in Canada", () => {
      expect(computeCrsEstimate({ ...BASE_PROFILE, has_provincial_nomination: true })?.breakdown.additional).toBe(600);
      expect(computeCrsEstimate({ ...BASE_PROFILE, has_sibling_in_canada: true })?.breakdown.additional).toBe(15);
    });

    it("adds 15 for 1–2 years and 30 for 3+ years of Canadian post-secondary education", () => {
      expect(computeCrsEstimate({ ...BASE_PROFILE, canadian_education_years: 2 })?.breakdown.additional).toBe(15);
      expect(computeCrsEstimate({ ...BASE_PROFILE, canadian_education_years: 4 })?.breakdown.additional).toBe(30);
    });

    it("scores nothing for a job offer (IRCC removed these points on 2025-03-25)", () => {
      expect(computeCrsEstimate({ ...BASE_PROFILE, has_canadian_job_offer: true })?.breakdown.additional).toBe(0);
    });

    it("caps additional points at 600", () => {
      const result = computeCrsEstimate({
        ...BASE_PROFILE,
        has_provincial_nomination: true,
        has_sibling_in_canada: true,
        canadian_education_years: 3,
      });
      expect(result?.breakdown.additional).toBe(600);
    });
  });

  describe("full profiles scored by hand against the IRCC grid", () => {
    it("scores 502 for a single applicant (30, bachelor's, CLB 9, 2 yrs Canadian, 3 yrs foreign)", () => {
      const result = computeCrsEstimate({ ...BASE_PROFILE, foreign_work_years: 3, foreign_work_recent: true });
      // 105 age + 120 education + 124 language + 53 Canadian work + 100 transferability
      expect(result?.score).toBe(502);
    });

    it("scores 433 with an accompanying spouse (master's, CLB 9, 2 yrs Canadian)", () => {
      const result = computeCrsEstimate({
        ...WITH_SPOUSE,
        canadian_work_years: 1,
        spouse_education_level: "masters",
        ...spouseClb(9),
        spouse_canadian_work_years: 2,
      });
      // 95 age + 112 education + 116 language + 35 Canadian work + 37 spouse + 38 transferability
      expect(result?.score).toBe(433);
    });
  });

  describe("confidence margin", () => {
    it("returns wide margin (80) for 3–4 scoreable fields", () => {
      const result = computeCrsEstimate({
        date_of_birth: "1990-01-01",
        education_level: "bachelors",
        clb_speaking: 9,
        requires_review: [],
      });
      expect(result?.margin).toBe(80);
    });

    it("returns narrow margin (20) for 12+ scoreable fields", () => {
      const result = computeCrsEstimate({
        ...BASE_PROFILE,
        foreign_work_years: 3,
        noc_teer_category: 1,
        eca_obtained: true,
        has_provincial_nomination: false,
        has_sibling_in_canada: true,
        canadian_education_years: 0,
        language_proficiency_self: "fluent",
      });
      expect(result?.margin).toBe(20);
    });

    it("margin narrows as more fields are added", () => {
      const few = computeCrsEstimate({
        date_of_birth: "1990-01-01",
        education_level: "bachelors",
        clb_speaking: 9,
        requires_review: [],
      });
      const many = computeCrsEstimate(BASE_PROFILE);
      expect(few!.margin).toBeGreaterThan(many!.margin);
    });
  });

  describe("FSW eligibility gate", () => {
    it("sets belowCutoff when CLB avg < 7", () => {
      const result = computeCrsEstimate({ ...BASE_PROFILE, ...clb(5) });
      expect(result?.belowCutoff).toBe(true);
      expect(result?.cutoffReason).toContain("CLB 7");
    });

    it("sets belowCutoff for secondary-only education", () => {
      const result = computeCrsEstimate({ ...BASE_PROFILE, education_level: "secondary" });
      expect(result?.belowCutoff).toBe(true);
    });

    it("does not set belowCutoff for a competitive profile", () => {
      const result = computeCrsEstimate(BASE_PROFILE);
      expect(result?.belowCutoff).toBeUndefined();
    });
  });

  describe("score range", () => {
    it("low = score - margin, high = score + margin (capped at 1200)", () => {
      const result = computeCrsEstimate(BASE_PROFILE);
      expect(result?.low).toBe(Math.max(0, result!.score - result!.margin));
      expect(result?.high).toBe(Math.min(1200, result!.score + result!.margin));
    });
  });
});

describe("crsFactorCaps", () => {
  const MAXED: CrsInput = {
    date_of_birth: dobForAge(25),
    education_level: "phd",
    ...clb(10),
    canadian_work_years: 5,
    foreign_work_years: 3,
    foreign_work_recent: true,
    requires_review: [],
  };

  it("matches a maxed single applicant's per-factor points", () => {
    const { age, education, language, experience, transferability } = computeCrsEstimate(MAXED)!.breakdown;
    expect({ age, education, language, experience, transferability }).toEqual(crsFactorCaps(false));
  });

  it("matches a maxed applicant's per-factor points with an accompanying spouse", () => {
    const maxed = computeCrsEstimate({ ...MAXED, spouse_coming_to_canada: true })!.breakdown;
    const { age, education, language, experience, transferability } = maxed;
    expect({ age, education, language, experience, transferability }).toEqual(crsFactorCaps(true));
  });

  it("sits exactly the unscored second-language points below IRCC's core maximum", () => {
    const core = (caps: ReturnType<typeof crsFactorCaps>) => caps.age + caps.education + caps.language + caps.experience;
    expect(core(crsFactorCaps(false))).toBe(500 - 24);
    expect(core(crsFactorCaps(true))).toBe(460 - 22);
  });
});

describe("computeClbPlusOneDelta", () => {
  it("returns the real score gain from a one-level CLB bump", () => {
    const profile: CrsInput = { ...BASE_PROFILE, ...clb(8) };
    const current = computeCrsEstimate(profile);
    const boosted = computeCrsEstimate({ ...profile, ...clb(9) });
    expect(computeClbPlusOneDelta(profile)).toBe(boosted!.score - current!.score);
  });

  it("returns null when the profile has no CLB data", () => {
    expect(
      computeClbPlusOneDelta({
        date_of_birth: "1990-06-15",
        education_level: "bachelors",
        language_proficiency_self: "fluent",
        requires_review: [],
      })
    ).toBeNull();
  });

  it("returns null when already at the CLB 10 points ceiling (no gain to report)", () => {
    expect(computeClbPlusOneDelta({ ...BASE_PROFILE, ...clb(10) })).toBeNull();
  });

  it("returns null when the estimate itself is not computable", () => {
    expect(computeClbPlusOneDelta({ clb_speaking: 8 })).toBeNull();
  });
});
