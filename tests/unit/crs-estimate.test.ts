import { describe, it, expect } from "vitest";
import { computeCrsEstimate, computeClbPlusOneDelta, CRS_FACTOR_CAPS } from "@/lib/crs-estimate";
import type { VoiceExtractedProfile } from "@/modules/voice/types";

const BASE_PROFILE: Partial<VoiceExtractedProfile> = {
  date_of_birth: "1990-06-15", // age ~35
  education_level: "bachelors",
  clb_speaking: 9,
  clb_listening: 9,
  clb_reading: 9,
  clb_writing: 9,
  canadian_work_years: 2,
  nationality: "Indian",
  requires_review: [],
};

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

  describe("age scoring", () => {
    it("scores 100 pts for age 30", () => {
      const result = computeCrsEstimate({
        ...BASE_PROFILE,
        date_of_birth: new Date(Date.now() - 30 * 365.25 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      });
      expect(result?.breakdown.age).toBe(100);
    });

    it("scores 0 pts for age 47", () => {
      const result = computeCrsEstimate({
        ...BASE_PROFILE,
        date_of_birth: new Date(Date.now() - 47 * 365.25 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      });
      expect(result?.breakdown.age).toBe(0);
    });

    it("scores 95 pts for age 36", () => {
      const result = computeCrsEstimate({
        ...BASE_PROFILE,
        date_of_birth: new Date(Date.now() - 36.5 * 365.25 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      });
      expect(result?.breakdown.age).toBe(95);
    });
  });

  describe("education scoring", () => {
    it("scores 150 for PhD", () => {
      const result = computeCrsEstimate({ ...BASE_PROFILE, education_level: "phd" });
      expect(result?.breakdown.education).toBe(150);
    });

    it("scores 120 for bachelors", () => {
      const result = computeCrsEstimate({ ...BASE_PROFILE, education_level: "bachelors" });
      expect(result?.breakdown.education).toBe(120);
    });

    it("deducts 10 for unassessed foreign credential", () => {
      const result = computeCrsEstimate({
        ...BASE_PROFILE,
        education_level: "bachelors",
        eca_obtained: false,
      });
      expect(result?.breakdown.education).toBe(110);
    });

    it("does not deduct for secondary (below ECA threshold)", () => {
      const result = computeCrsEstimate({
        ...BASE_PROFILE,
        education_level: "secondary",
        eca_obtained: false,
      });
      expect(result?.breakdown.education).toBe(30);
    });
  });

  describe("language scoring", () => {
    it("scores 4 × 34 = 136 for CLB 10 across all skills", () => {
      const result = computeCrsEstimate({
        ...BASE_PROFILE,
        clb_speaking: 10,
        clb_listening: 10,
        clb_reading: 10,
        clb_writing: 10,
      });
      expect(result?.breakdown.language).toBe(136);
    });

    it("scores 4 × 17 = 68 for CLB 7 across all skills", () => {
      const result = computeCrsEstimate({
        ...BASE_PROFILE,
        clb_speaking: 7,
        clb_listening: 7,
        clb_reading: 7,
        clb_writing: 7,
      });
      expect(result?.breakdown.language).toBe(68);
    });

    it("falls back to language_proficiency_self when CLB absent", () => {
      const { clb_speaking, clb_listening, clb_reading, clb_writing, ...withoutCLB } = BASE_PROFILE;
      void clb_speaking; void clb_listening; void clb_reading; void clb_writing;
      const result = computeCrsEstimate({ ...withoutCLB, language_proficiency_self: "fluent" });
      expect(result?.breakdown.language).toBe(116);
    });
  });

  describe("work experience scoring", () => {
    it("scores 40 pts for 1 year Canadian experience", () => {
      const result = computeCrsEstimate({ ...BASE_PROFILE, canadian_work_years: 1 });
      expect(result?.breakdown.experience).toBe(40);
    });

    it("scores 64 pts for 3+ years Canadian experience", () => {
      const result = computeCrsEstimate({ ...BASE_PROFILE, canadian_work_years: 4 });
      expect(result?.breakdown.experience).toBe(64);
    });

    it("returns 0 work pts for TEER 4 occupations", () => {
      const result = computeCrsEstimate({ ...BASE_PROFILE, noc_teer_category: 4 });
      expect(result?.breakdown.experience).toBe(0);
    });

    it("returns 0 work pts for TEER 5 occupations", () => {
      const result = computeCrsEstimate({ ...BASE_PROFILE, noc_teer_category: 5 });
      expect(result?.breakdown.experience).toBe(0);
    });
  });

  describe("additional factors", () => {
    it("adds 600 pts for provincial nomination", () => {
      const result = computeCrsEstimate({ ...BASE_PROFILE, has_provincial_nomination: true });
      const base = computeCrsEstimate(BASE_PROFILE);
      expect(result!.breakdown.additional - (base?.breakdown.additional ?? 0)).toBe(600);
    });

    it("adds 15 pts for sibling in Canada", () => {
      const withSibling = computeCrsEstimate({ ...BASE_PROFILE, has_sibling_in_canada: true });
      const without = computeCrsEstimate(BASE_PROFILE);
      expect(withSibling!.breakdown.additional - (without?.breakdown.additional ?? 0)).toBe(15);
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
        clb_speaking: 9,
        clb_listening: 9,
        clb_reading: 9,
        clb_writing: 9,
        canadian_work_years: 2,
        foreign_work_years: 3,
        noc_teer_category: 1,
        eca_obtained: true,
        has_provincial_nomination: false,
        has_canadian_job_offer: true,
        has_sibling_in_canada: true,
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
      const result = computeCrsEstimate({
        ...BASE_PROFILE,
        clb_speaking: 5,
        clb_listening: 5,
        clb_reading: 5,
        clb_writing: 5,
      });
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

describe("CRS_FACTOR_CAPS", () => {
  it("matches the estimator's per-factor maxima", () => {
    // A maxed profile should hit every core-factor cap exactly.
    const maxed = computeCrsEstimate({
      date_of_birth: new Date(Date.now() - 30 * 365.25 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      education_level: "phd",
      clb_speaking: 10, clb_listening: 10, clb_reading: 10, clb_writing: 10,
      canadian_work_years: 3,
      foreign_work_years: 4,
      foreign_work_recent: true,
      requires_review: [],
    });
    expect(maxed?.breakdown.age).toBe(CRS_FACTOR_CAPS.age);
    expect(maxed?.breakdown.education).toBe(CRS_FACTOR_CAPS.education);
    expect(maxed?.breakdown.language).toBe(CRS_FACTOR_CAPS.language);
    expect(maxed?.breakdown.experience).toBe(CRS_FACTOR_CAPS.experience);
    expect(maxed?.breakdown.transferability).toBe(CRS_FACTOR_CAPS.transferability);
  });
});

describe("computeClbPlusOneDelta", () => {
  it("returns the real score gain from a one-level CLB bump", () => {
    const profile: Partial<VoiceExtractedProfile> = {
      ...BASE_PROFILE,
      clb_speaking: 8, clb_listening: 8, clb_reading: 8, clb_writing: 8,
    };
    const current = computeCrsEstimate(profile);
    const boosted = computeCrsEstimate({
      ...profile,
      clb_speaking: 9, clb_listening: 9, clb_reading: 9, clb_writing: 9,
    });
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
    expect(
      computeClbPlusOneDelta({
        ...BASE_PROFILE,
        clb_speaking: 10, clb_listening: 10, clb_reading: 10, clb_writing: 10,
      })
    ).toBeNull();
  });

  it("returns null when the estimate itself is not computable", () => {
    expect(computeClbPlusOneDelta({ clb_speaking: 8 })).toBeNull();
  });
});
