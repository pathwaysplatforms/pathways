import { describe, it, expect, vi, beforeEach } from "vitest";
import { matchPathways, getCachedMatch } from "@/lib/pathway-matcher";
import { ValidationError, DatabaseError, InternalError } from "@/lib/errors";

// ─── Shared mock fns (defined outside vi.mock so they can be controlled per-test) ─

const mockSingle = vi.fn();
const mockInsert = vi.fn().mockResolvedValue({ error: null });
const mockOrder = vi.fn();
const mockLimit = vi.fn();
const mockEq = vi.fn();
const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockRpc = vi.fn();
const mockCreate = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(() => ({
    from: mockFrom,
    rpc: mockRpc,
  })),
}));

vi.mock("@/lib/embeddings", () => ({
  embedProfile: vi.fn().mockResolvedValue(new Array(1536).fill(0)),
  profileToNLSummary: vi.fn().mockReturnValue("Indian national, software engineer."),
}));

// Shared mockCreate allows per-test overrides via mockResolvedValueOnce
vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn(() => ({ messages: { create: mockCreate } })),
}));

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const USER_ID = "00000000-0000-0000-0000-000000000001";

const THREE_PATHWAYS = [
  {
    pathway_id: "canada-express-entry-fsw",
    pathway_name: "Express Entry – Federal Skilled Worker",
    country_code: "CA",
    country_name: "Canada",
    flag_emoji: "🇨🇦",
    pathway_type: "permanent_residency",
    match_score: 88,
    match_label: "Excellent match",
    why_it_fits: "Strong candidate with CLB 10 and 5 years TEER 1 experience.",
    key_requirements: ["CLB 7+", "NOC TEER 0-3", "1 year work experience"],
    gap_analysis: null,
    estimated_timeline: "6–12 months",
    source_url: "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/eligibility/federal-skilled-workers.html",
    retrieved_chunks: ["Express Entry chunk 1"],
  },
  {
    pathway_id: "canada-pnp-ontario-oinp",
    pathway_name: "Ontario Immigrant Nominee Program (OINP)",
    country_code: "CA",
    country_name: "Canada",
    flag_emoji: "🇨🇦",
    pathway_type: "permanent_residency",
    match_score: 75,
    match_label: "Good match",
    why_it_fits: "EE-linked OINP nomination possible given strong CRS.",
    key_requirements: ["Active EE profile", "CLB 7+", "NOC TEER 0-3"],
    gap_analysis: "Ontario issues NOIs proactively — no direct application.",
    estimated_timeline: "12–18 months",
    source_url: "https://www.ontario.ca/page/ontario-immigrant-nominee-program-oinp",
    retrieved_chunks: ["OINP chunk 1"],
  },
  {
    pathway_id: "germany-eu-blue-card",
    pathway_name: "Germany EU Blue Card",
    country_code: "DE",
    country_name: "Germany",
    flag_emoji: "🇩🇪",
    pathway_type: "work_permit",
    match_score: 62,
    match_label: "Good match",
    why_it_fits: "Bachelor's degree and IT occupation make you eligible.",
    key_requirements: ["Recognised degree", "Job offer in Germany", "EUR 45,300 salary"],
    gap_analysis: "Degree recognition can take 1–3 months.",
    estimated_timeline: "3–6 months",
    source_url: "https://www.make-it-in-germany.com/en/visa-residence/types/eu-blue-card",
    retrieved_chunks: ["Blue Card chunk 1"],
  },
];

const VALID_CLAUDE_RESPONSE = {
  user_id: USER_ID,
  matched_at: new Date().toISOString(),
  top_pathways: THREE_PATHWAYS,
  summary: "You are a strong Express Entry candidate.",
};

const completeProfile = {
  id: USER_ID,
  auth_user_id: "00000000-0000-0000-0000-000000000002",
  onboarding_status: "complete",
  full_name: "Arjun Sharma",
  nationality: "Indian",
  current_country: "India",
  occupation: "Software Engineer",
  years_experience: 5,
  marital_status: "married",
  date_of_birth: "1995-04-15",
  annual_income: 80000,
  income_currency: "CAD",
  education_level: "bachelors",
  eca_obtained: true,
  clb_speaking: 9,
  clb_listening: 10,
  clb_reading: 10,
  clb_writing: 9,
  canadian_work_years: 0,
  foreign_work_years: 5,
  foreign_work_recent: true,
  noc_teer_category: 1,
  noc_code: "21232",
  has_provincial_nomination: false,
  has_canadian_job_offer: false,
  has_sibling_in_canada: false,
  spouse_coming_to_canada: true,
  destination_country: "Canada",
};

const sampleChunk = {
  id: "00000000-0000-0000-0000-000000000099",
  pathway_id: "canada-express-entry-fsw",
  pathway_name: "Express Entry – Federal Skilled Worker",
  country_code: "CA",
  pathway_type: "permanent_residency",
  chunk_text: "Express Entry requires CLB 7+",
  source_url: "https://canada.ca/express-entry",
  metadata: {},
  similarity: 0.92,
};

function setupSuccessfulDbMocks() {
  mockSingle.mockResolvedValue({ data: completeProfile, error: null });
  mockEq.mockReturnValue({ single: mockSingle });
  mockSelect.mockReturnValue({ eq: mockEq });

  mockOrder.mockReturnValue({ limit: mockLimit });
  mockLimit.mockReturnValue({ single: vi.fn().mockResolvedValue({ data: null, error: null }) });

  mockInsert.mockResolvedValue({ error: null });

  mockFrom.mockImplementation((table: string) => {
    if (table === "profiles") return { select: mockSelect };
    if (table === "pathway_matches") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ order: mockOrder }),
        }),
        insert: mockInsert,
      };
    }
    return { select: mockSelect, insert: mockInsert };
  });

  mockRpc.mockResolvedValue({
    data: [
      sampleChunk,
      { ...sampleChunk, pathway_id: "canada-pnp-ontario-oinp", pathway_name: "Ontario Immigrant Nominee Program (OINP)", similarity: 0.88 },
      { ...sampleChunk, pathway_id: "germany-eu-blue-card", pathway_name: "Germany EU Blue Card", country_code: "DE", similarity: 0.75 },
    ],
    error: null,
  });

  mockCreate.mockResolvedValue({
    content: [{ type: "text", text: JSON.stringify(VALID_CLAUDE_RESPONSE) }],
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("matchPathways", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    process.env.OPENAI_API_KEY = "sk-test";
    setupSuccessfulDbMocks();
  });

  it("returns a valid PathwayMatchResult with 3 pathways on happy path", async () => {
    const result = await matchPathways(USER_ID);

    expect(result.user_id).toBe(USER_ID);
    expect(result.top_pathways).toHaveLength(3);
    expect(result.top_pathways[0].pathway_id).toBe("canada-express-entry-fsw");
    expect(result.summary).toContain("Express Entry");
  });

  it("throws ValidationError when onboarding_status is not complete", async () => {
    mockSingle.mockResolvedValueOnce({
      data: { ...completeProfile, onboarding_status: "voice_complete" },
      error: null,
    });

    await expect(matchPathways(USER_ID)).rejects.toThrow(ValidationError);
  });

  it("throws DatabaseError when profile fetch fails", async () => {
    mockSingle.mockResolvedValueOnce({
      data: null,
      error: { message: "row not found" },
    });

    await expect(matchPathways(USER_ID)).rejects.toThrow(DatabaseError);
  });

  it("throws InternalError when pathway_documents table is empty", async () => {
    mockRpc.mockResolvedValueOnce({ data: [], error: null });

    await expect(matchPathways(USER_ID)).rejects.toThrow(InternalError);
  });

  it("throws InternalError when Claude returns invalid JSON", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: "NOT VALID JSON {{" }],
    });

    await expect(matchPathways(USER_ID)).rejects.toThrow(InternalError);
  });
});

describe("getCachedMatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockOrder.mockReturnValue({ limit: mockLimit });
    mockLimit.mockReturnValue({ single: mockSingle });
    mockEq.mockReturnValue({ order: mockOrder });
    const mockSelectForMatches = vi.fn().mockReturnValue({ eq: mockEq });
    mockFrom.mockImplementation(() => ({ select: mockSelectForMatches }));
  });

  it("returns a validated result when a cached match exists", async () => {
    const cachedData = {
      user_id: USER_ID,
      matched_at: new Date().toISOString(),
      summary: "You have great options.",
      top_pathways: THREE_PATHWAYS,
    };
    mockSingle.mockResolvedValue({ data: cachedData, error: null });

    const result = await getCachedMatch(USER_ID);
    expect(result).not.toBeNull();
    expect(result?.top_pathways).toHaveLength(3);
    expect(result?.user_id).toBe(USER_ID);
  });

  it("returns null when no cached match exists", async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: "no rows" } });

    const result = await getCachedMatch(USER_ID);
    expect(result).toBeNull();
  });

  it("returns null when the cached data fails schema validation", async () => {
    mockSingle.mockResolvedValue({
      data: { user_id: USER_ID, top_pathways: [], matched_at: "bad", summary: "" },
      error: null,
    });

    const result = await getCachedMatch(USER_ID);
    expect(result).toBeNull();
  });
});
