import { describe, it, expect } from "vitest";
import { buildPathwayInput } from "@/lib/pathway-input";
import { computeCrsEstimate } from "@/lib/crs-estimate";

describe("buildPathwayInput crs_estimate", () => {
  it("takes its range from the shared CRS estimator", () => {
    const profile = {
      date_of_birth: "1994-01-01",
      education_level: "bachelors" as const,
      clb_speaking: 9,
      clb_listening: 9,
      clb_reading: 9,
      clb_writing: 9,
      canadian_work_years: 2,
      requires_review: [],
    };
    const estimate = computeCrsEstimate(profile);
    const input = buildPathwayInput("profile-1", profile, null);

    expect(input.crs_estimate.range_low).toBe(estimate?.low);
    expect(input.crs_estimate.range_high).toBe(estimate?.high);
    expect(input.crs_estimate.based_on).toEqual(
      expect.arrayContaining(["age", "education", "language", "experience", "transferability"])
    );
  });

  it("scores the normalized voice education answer when no structured level exists", () => {
    const input = buildPathwayInput(
      "profile-1",
      {
        date_of_birth: "1994-01-01",
        education_level_voice: "Master of Science in Biology",
        language_proficiency_self: "fluent",
        requires_review: [],
      },
      null
    );
    const estimate = computeCrsEstimate({
      date_of_birth: "1994-01-01",
      education_level: "masters",
      language_proficiency_self: "fluent",
    });

    expect(input.crs_estimate.range_high).toBe(estimate?.high);
    expect(input.crs_estimate.based_on).toContain("education");
  });

  it("returns a zero range when the profile is too sparse to estimate", () => {
    const input = buildPathwayInput("profile-1", { nationality: "Kenyan", requires_review: [] }, null);

    expect(input.crs_estimate.range_low).toBe(0);
    expect(input.crs_estimate.range_high).toBe(0);
    expect(input.crs_estimate.based_on).toEqual([]);
  });
});
