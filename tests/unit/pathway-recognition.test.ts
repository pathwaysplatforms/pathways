import { describe, it, expect, vi, beforeEach } from "vitest";

const mockUpdate = vi.fn();
const mockEq = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

vi.mock("@/lib/logger", () => ({
  createRequestLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

import { triggerPathwayRecognition } from "@/lib/pathway-recognition";
import type { VoiceExtractedProfile } from "@/modules/voice/types";
import { createRequestLogger } from "@/lib/logger";

function makeLogger() {
  return createRequestLogger("test");
}

const COMPLETE_PROFILE: VoiceExtractedProfile = {
  full_name: "Priya Sharma",
  date_of_birth: "1990-06-15",
  nationality: "Indian",
  current_country: "India",
  marital_status: "single",
  education_level_voice: "Bachelor's in Computer Science",
  years_experience: 5,
  has_canadian_experience: false,
  occupation: "Software Engineer",
  language_proficiency_self: "fluent",
  has_family_in_canada: false,
  intended_province: "Ontario",
  annual_income: 80000,
  income_currency: "CAD",
  clb_speaking: 9,
  clb_listening: 9,
  clb_reading: 9,
  clb_writing: 9,
  canadian_work_years: 1,
  foreign_work_years: 4,
  canadian_work_recent: true,
  foreign_work_recent: true,
  noc_teer_category: 1,
  noc_code: null,
  education_level: "bachelors",
  eca_obtained: true,
  spouse_coming_to_canada: false,
  spouse_education_level: null,
  spouse_clb_speaking: null,
  spouse_clb_listening: null,
  spouse_clb_reading: null,
  spouse_clb_writing: null,
  spouse_canadian_work_years: null,
  has_provincial_nomination: false,
  has_canadian_job_offer: false,
  has_sibling_in_canada: false,
  destination_country: null,
  purpose: null,
  dependents: null,
  requires_review: [],
};

describe("triggerPathwayRecognition", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEq.mockResolvedValue({ error: null });
    mockUpdate.mockReturnValue({ eq: mockEq });
    mockFrom.mockReturnValue({ update: mockUpdate });
  });

  it("writes pathway_input_json with all required keys on success", async () => {
    await triggerPathwayRecognition("profile-123", COMPLETE_PROFILE, makeLogger());

    expect(mockFrom).toHaveBeenCalledWith("profiles");
    expect(mockUpdate).toHaveBeenCalledOnce();

    const updateArg = mockUpdate.mock.calls[0][0] as { pathway_input_json: Record<string, unknown> };
    const json = updateArg.pathway_input_json;

    expect(json).toHaveProperty("nationality");
    expect(json).toHaveProperty("destination_country");
    expect(json).toHaveProperty("clb_speaking");
    expect(json).toHaveProperty("education_level");
    expect(json).toHaveProperty("crs_estimate");
    expect(json).toHaveProperty("crs_estimate_low");
    expect(json).toHaveProperty("crs_estimate_high");
    expect(mockEq).toHaveBeenCalledWith("id", "profile-123");
  });

  it("uses Canada as default destination_country when not set", async () => {
    const profile = { ...COMPLETE_PROFILE, destination_country: null };
    await triggerPathwayRecognition("profile-456", profile, makeLogger());

    const updateArg = mockUpdate.mock.calls[0][0] as { pathway_input_json: Record<string, unknown> };
    expect(updateArg.pathway_input_json.destination_country).toBe("Canada");
  });

  it("logs an error and does not throw when the DB update fails", async () => {
    const log = makeLogger();
    mockEq.mockResolvedValue({ error: { message: "DB error" } });

    await expect(
      triggerPathwayRecognition("profile-789", COMPLETE_PROFILE, log)
    ).resolves.toBeUndefined();

    expect(log.error).toHaveBeenCalledOnce();
  });

  it("includes a numeric CRS estimate for a scoreable profile", async () => {
    await triggerPathwayRecognition("profile-123", COMPLETE_PROFILE, makeLogger());

    const updateArg = mockUpdate.mock.calls[0][0] as { pathway_input_json: Record<string, unknown> };
    const json = updateArg.pathway_input_json;

    expect(typeof json.crs_estimate).toBe("number");
    expect(json.crs_estimate as number).toBeGreaterThan(0);
  });
});
