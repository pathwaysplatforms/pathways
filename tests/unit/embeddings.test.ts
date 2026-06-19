import { describe, it, expect, vi, beforeEach } from "vitest";
import { profileToNLSummary, embedText, embedProfile } from "@/lib/embeddings";
import type { VoiceExtractedProfile } from "@/modules/voice/types";

// Mock OpenAI
vi.mock("openai", () => {
  const mockCreate = vi.fn().mockResolvedValue({
    data: [{ embedding: Array.from({ length: 1536 }, (_, i) => i / 1536) }],
  });
  return {
    default: vi.fn(function () {
      return { embeddings: { create: mockCreate } };
    }),
    __mockCreate: mockCreate,
  };
});

const fullProfile: Partial<VoiceExtractedProfile> = {
  full_name: "Arjun Sharma",
  date_of_birth: "1995-04-15",
  nationality: "Indian",
  current_country: "India",
  marital_status: "married",
  occupation: "Software Engineer",
  noc_code: "21232",
  noc_teer_category: 1,
  education_level: "bachelors",
  eca_obtained: true,
  clb_speaking: 9,
  clb_listening: 10,
  clb_reading: 10,
  clb_writing: 9,
  canadian_work_years: 0,
  foreign_work_years: 5,
  foreign_work_recent: true,
  has_provincial_nomination: false,
  has_canadian_job_offer: false,
  has_sibling_in_canada: false,
  spouse_coming_to_canada: true,
  spouse_education_level: "bachelors",
  spouse_clb_speaking: 7,
  spouse_clb_listening: 7,
  spouse_clb_reading: 7,
  spouse_clb_writing: 7,
  destination_country: "Canada",
  requires_review: [],
};

describe("profileToNLSummary", () => {
  it("includes nationality and age in output", () => {
    const summary = profileToNLSummary(fullProfile);
    expect(summary).toContain("Indian");
    expect(summary).toMatch(/\d+ years old/);
  });

  it("includes CLB scores when available", () => {
    const summary = profileToNLSummary(fullProfile);
    expect(summary).toContain("CLB");
    expect(summary).toContain("listening 10");
    expect(summary).toContain("speaking 9");
  });

  it("falls back to self-assessed language if no CLB scores", () => {
    const partial: Partial<VoiceExtractedProfile> = {
      nationality: "Brazilian",
      language_proficiency_self: "advanced",
      requires_review: [],
    };
    const summary = profileToNLSummary(partial);
    expect(summary).toContain("advanced");
    expect(summary).not.toContain("CLB");
  });

  it("includes ECA information in education section", () => {
    const summary = profileToNLSummary(fullProfile);
    expect(summary).toContain("ECA");
  });

  it("includes accompanying spouse information", () => {
    const summary = profileToNLSummary(fullProfile);
    expect(summary).toContain("spouse");
    expect(summary).toContain("CLB 7");
  });

  it("notes no provincial nomination and no job offer", () => {
    const summary = profileToNLSummary(fullProfile);
    expect(summary).toContain("no provincial nomination");
    expect(summary).toContain("no Canadian job offer");
  });

  it("handles a minimal profile gracefully", () => {
    const summary = profileToNLSummary({ nationality: "German", requires_review: [] });
    expect(summary).toContain("German");
    expect(typeof summary).toBe("string");
    expect(summary.length).toBeGreaterThan(0);
  });

  it("includes work experience when present", () => {
    const summary = profileToNLSummary(fullProfile);
    expect(summary).toContain("5");
    expect(summary).toContain("foreign");
  });

  it("mentions occupation and NOC code", () => {
    const summary = profileToNLSummary(fullProfile);
    expect(summary).toContain("Software Engineer");
    expect(summary).toContain("21232");
  });
});

describe("embedText", () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = "sk-test-key";
  });

  it("returns a 1536-dimensional vector", async () => {
    const vec = await embedText("test input");
    expect(Array.isArray(vec)).toBe(true);
    expect(vec).toHaveLength(1536);
  });

  it("throws when OPENAI_API_KEY is missing", async () => {
    const saved = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    await expect(embedText("hello")).rejects.toThrow("OPENAI_API_KEY");
    process.env.OPENAI_API_KEY = saved;
  });

  it("returns numeric values in the vector", async () => {
    const vec = await embedText("immigration profile");
    expect(vec.every((v) => typeof v === "number")).toBe(true);
  });
});

describe("embedProfile", () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = "sk-test-key";
  });

  it("returns a 1536-dimensional vector for a full profile", async () => {
    const vec = await embedProfile(fullProfile);
    expect(vec).toHaveLength(1536);
  });

  it("returns a vector for a minimal profile without throwing", async () => {
    const vec = await embedProfile({ nationality: "French", requires_review: [] });
    expect(vec).toHaveLength(1536);
  });

  it("throws when OPENAI_API_KEY is missing", async () => {
    const saved = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    await expect(embedProfile(fullProfile)).rejects.toThrow("OPENAI_API_KEY");
    process.env.OPENAI_API_KEY = saved;
  });
});
