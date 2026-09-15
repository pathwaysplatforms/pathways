import { describe, it, expect } from "vitest";
import { profileRowToCrsInput } from "@/lib/crs-input";
import { computeCrsEstimate } from "@/lib/crs-estimate";

describe("profileRowToCrsInput", () => {
  it("maps populated profile columns onto the estimator input", () => {
    const input = profileRowToCrsInput({
      date_of_birth: "1992-03-10",
      education_level: "masters",
      eca_obtained: true,
      clb_speaking: 9,
      clb_listening: 8,
      clb_reading: 9,
      clb_writing: 8,
      canadian_work_years: 2,
      foreign_work_years: 4,
      foreign_work_recent: true,
      noc_teer_category: 1,
      has_provincial_nomination: false,
      has_sibling_in_canada: true,
      canadian_education_years: 3,
      spouse_coming_to_canada: true,
      spouse_education_level: "bachelors",
    });

    expect(input.date_of_birth).toBe("1992-03-10");
    expect(input.education_level).toBe("masters");
    expect(input.clb_listening).toBe(8);
    expect(input.foreign_work_recent).toBe(true);
    expect(input.has_sibling_in_canada).toBe(true);
    expect(input.canadian_education_years).toBe(3);
    expect(input.spouse_education_level).toBe("bachelors");
  });

  it("carries Canadian education and spouse education through to the score", () => {
    const base = {
      date_of_birth: "1994-01-01",
      education_level: "bachelors",
      clb_speaking: 9,
      clb_listening: 9,
      clb_reading: 9,
      clb_writing: 9,
      spouse_coming_to_canada: true,
    };
    const without = computeCrsEstimate(profileRowToCrsInput(base));
    const withBoth = computeCrsEstimate(
      profileRowToCrsInput({ ...base, canadian_education_years: 3, spouse_education_level: "masters" })
    );

    // +30 Canadian post-secondary (3+ years) and +10 spouse master's
    expect(withBoth!.score - without!.score).toBe(40);
  });

  it("converts null columns to undefined so the estimator's null checks behave", () => {
    const input = profileRowToCrsInput({
      date_of_birth: null,
      education_level: null,
      clb_speaking: null,
      has_canadian_job_offer: null,
    });

    expect(input.date_of_birth).toBeNull();
    expect(input.education_level).toBeUndefined();
    expect(input.clb_speaking).toBeUndefined();
    expect(input.has_canadian_job_offer).toBeUndefined();
  });

  it("produces input the estimator scores identically to a hand-built profile", () => {
    const input = profileRowToCrsInput({
      date_of_birth: "1994-01-01",
      education_level: "bachelors",
      clb_speaking: 9,
      clb_listening: 9,
      clb_reading: 9,
      clb_writing: 9,
      canadian_work_years: 2,
    });
    const direct = computeCrsEstimate({
      date_of_birth: "1994-01-01",
      education_level: "bachelors",
      clb_speaking: 9,
      clb_listening: 9,
      clb_reading: 9,
      clb_writing: 9,
      canadian_work_years: 2,
      requires_review: [],
    });

    expect(computeCrsEstimate(input)?.score).toBe(direct?.score);
  });

  it("returns non-scoreable input from an empty row (estimator yields null)", () => {
    expect(computeCrsEstimate(profileRowToCrsInput({}))).toBeNull();
  });
});
