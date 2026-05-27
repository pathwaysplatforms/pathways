import { describe, it, expect, vi, beforeEach } from "vitest";
import { DatabaseError, ValidationError } from "@/lib/errors";

const mockAnthropicCreate = vi.hoisted(() => vi.fn());
const mockFetch = vi.hoisted(() => vi.fn());

vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: mockAnthropicCreate },
  })),
}));

vi.mock("@/lib/supabase/server");
vi.mock("@/lib/supabase/admin");
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => ({ getAll: vi.fn(() => []), set: vi.fn() })),
}));
vi.mock("@/lib/logger", () => ({
  createRequestLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

global.fetch = mockFetch;

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createRequestLogger } from "@/lib/logger";
import {
  createVoiceSession,
  processConversationTurn,
  finalizeVoiceSession,
  confirmVoiceProfile,
  validateExtractedProfile,
} from "../service";
import type { VoiceExtractedProfile } from "../types";

/**
 * A thenable query chain that resolves to `resolvedValue` when awaited directly,
 * and also exposes `.single()` for callers that terminate with .single().
 */
function makeQueryChain(resolvedValue: unknown) {
  const chain = {
    then: (
      onFulfilled?: ((v: unknown) => unknown) | null,
      onRejected?: ((r: unknown) => unknown) | null
    ) => Promise.resolve(resolvedValue).then(onFulfilled, onRejected),
    catch: (onRejected?: ((r: unknown) => unknown) | null) =>
      Promise.resolve(resolvedValue).catch(onRejected),
    select: vi.fn(),
    eq: vi.fn(),
    single: vi.fn().mockResolvedValue(resolvedValue),
    insert: vi.fn(),
    update: vi.fn(),
  };
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.insert.mockReturnValue(chain);
  chain.update.mockReturnValue(chain);
  return chain;
}

type QueryChain = ReturnType<typeof makeQueryChain>;
type MockClient = { from: ReturnType<typeof vi.fn>; auth: { getSession: ReturnType<typeof vi.fn> } };

function makeClient(chain: QueryChain): MockClient {
  return { from: vi.fn().mockReturnValue(chain), auth: { getSession: vi.fn() } };
}

function mockServer(client: MockClient) {
  vi.mocked(createSupabaseServerClient).mockReturnValue(
    client as unknown as ReturnType<typeof createSupabaseServerClient>
  );
}

function mockAdmin(client: MockClient) {
  vi.mocked(createSupabaseAdminClient).mockReturnValue(
    client as unknown as ReturnType<typeof createSupabaseAdminClient>
  );
}

function mockLog() {
  return vi.mocked(createRequestLogger)("test");
}

const profileId = "profile-uuid-123";
const sessionId = "session-uuid-456";

/** A complete valid extracted profile using the new Canadian-focused fields. */
const validExtracted: VoiceExtractedProfile = {
  full_name: "Priya Sharma",
  date_of_birth: "1990-05-15",
  nationality: "Indian",
  current_country: "United Kingdom",
  marital_status: "married",
  spouse_coming_to_canada: true,
  education_level_voice: "Master's in Computer Science",
  years_experience: 7,
  has_canadian_experience: false,
  occupation: "Software Engineer",
  language_proficiency_self: "fluent",
  has_family_in_canada: false,
  intended_province: "Ontario",
  annual_income: 85000,
  income_currency: "GBP",
  requires_review: [],
};

/**
 * Build a mock Anthropic response using the new PROFILE_DELTA tag format.
 * Claude now returns prose + a <PROFILE_DELTA>...</PROFILE_DELTA> block.
 */
function claudeProfileDeltaResponse(message: string, delta: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  const deltaJson = JSON.stringify({ ...delta, ...extra });
  const text = `${message}\n<PROFILE_DELTA>${deltaJson}</PROFILE_DELTA>`;
  return { content: [{ type: "text", text }] };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockFetch.mockReset();
  process.env.ELEVENLABS_API_KEY = "test-eleven-key";
  mockFetch.mockResolvedValue({
    ok: true,
    arrayBuffer: async () => new ArrayBuffer(8),
  });
});

describe("createVoiceSession", () => {
  it("inserts a row and returns the session ID", async () => {
    const chain = makeQueryChain({ data: { id: sessionId }, error: null });
    mockServer(makeClient(chain));

    const result = await createVoiceSession(profileId, mockLog());

    expect(result).toBe(sessionId);
    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ profile_id: profileId, status: "in_progress" })
    );
  });

  it("throws DatabaseError when insert fails", async () => {
    const chain = makeQueryChain({ data: null, error: { message: "db error" } });
    mockServer(makeClient(chain));

    await expect(createVoiceSession(profileId, mockLog())).rejects.toThrow(DatabaseError);
  });

  it("throws DatabaseError when no data is returned", async () => {
    const chain = makeQueryChain({ data: null, error: null });
    mockServer(makeClient(chain));

    await expect(createVoiceSession(profileId, mockLog())).rejects.toThrow(DatabaseError);
  });
});

describe("processConversationTurn — delta merging with PROFILE_DELTA format", () => {
  it("merges newly extracted fields into the existing partial profile", async () => {
    const existingData = { full_name: "Priya", requires_review: [] };
    const chain = makeQueryChain({
      data: { id: sessionId, profile_id: profileId, extracted_data: existingData, transcript: "" },
      error: null,
    });
    mockServer(makeClient(chain));

    mockAnthropicCreate.mockResolvedValue(
      claudeProfileDeltaResponse("What is your nationality?", { nationality: "Indian" })
    );

    const result = await processConversationTurn(
      sessionId, profileId, "My name is Priya", [], Date.now() - 5000, mockLog()
    );

    expect(result.message).toBe("What is your nationality?");
    expect(result.complete).toBe(false);
    expect(result.audioBase64).toBeTruthy();

    const updateCall = chain.update.mock.calls[0][0] as {
      extracted_data: { full_name: string; nationality: string };
    };
    expect(updateCall.extracted_data.full_name).toBe("Priya");
    expect(updateCall.extracted_data.nationality).toBe("Indian");
  });

  it("accumulates requires_review fields across turns", async () => {
    const existingData = { full_name: "Priya", requires_review: ["nationality"] };
    const chain = makeQueryChain({
      data: { id: sessionId, profile_id: profileId, extracted_data: existingData, transcript: "" },
      error: null,
    });
    mockServer(makeClient(chain));

    mockAnthropicCreate.mockResolvedValue(
      claudeProfileDeltaResponse(
        "I see. Where are you currently living?",
        { current_country: "UK" },
        { requires_review: ["current_country"] }
      )
    );

    await processConversationTurn(
      sessionId, profileId, "I live in the UK", [], Date.now(), mockLog()
    );

    const updateCall = chain.update.mock.calls[0][0] as {
      extracted_data: { requires_review: string[] };
    };
    expect(updateCall.extracted_data.requires_review).toContain("nationality");
    expect(updateCall.extracted_data.requires_review).toContain("current_country");
  });

  it("treats a plain prose response (no PROFILE_DELTA) as message with empty delta", async () => {
    const chain = makeQueryChain({
      data: { id: sessionId, profile_id: profileId, extracted_data: {}, transcript: "" },
      error: null,
    });
    mockServer(makeClient(chain));

    mockAnthropicCreate.mockResolvedValue({
      content: [{ type: "text", text: "Could you please repeat that?" }],
    });

    const result = await processConversationTurn(
      sessionId, profileId, "huh", [], Date.now(), mockLog()
    );

    expect(result.message).toBe("Could you please repeat that?");
    expect(result.complete).toBe(false);
  });
});

describe("processConversationTurn — error handling", () => {
  it("throws DatabaseError when session is not found", async () => {
    const chain = makeQueryChain({ data: null, error: { message: "no rows" } });
    mockServer(makeClient(chain));

    await expect(
      processConversationTurn(sessionId, profileId, "hello", [], Date.now(), mockLog())
    ).rejects.toThrow(DatabaseError);
  });

  it("throws ValidationError when Anthropic returns an unexpected response type", async () => {
    const chain = makeQueryChain({
      data: { id: sessionId, profile_id: profileId, extracted_data: {}, transcript: "" },
      error: null,
    });
    mockServer(makeClient(chain));

    mockAnthropicCreate.mockResolvedValue({ content: [{ type: "image" }] });

    await expect(
      processConversationTurn(sessionId, profileId, "hello", [], Date.now(), mockLog())
    ).rejects.toThrow(ValidationError);
  });

  it("throws DatabaseError when session update fails", async () => {
    const getChain = makeQueryChain({
      data: { id: sessionId, profile_id: profileId, extracted_data: {}, transcript: "" },
      error: null,
    });
    mockServer(makeClient(getChain));
    const errorChain = {
      ...getChain,
      then: (r: ((v: unknown) => unknown) | null | undefined) =>
        Promise.resolve({ error: { message: "update failed" } }).then(r),
    };
    // eq() must also return the error chain so the await resolves to the error
    errorChain.eq = vi.fn().mockReturnValue(errorChain);
    getChain.update.mockReturnValue(errorChain);

    mockAnthropicCreate.mockResolvedValue(
      claudeProfileDeltaResponse("Got it!", { occupation: "Engineer" })
    );

    await expect(
      processConversationTurn(sessionId, profileId, "I am an engineer", [], Date.now(), mockLog())
    ).rejects.toThrow(DatabaseError);
  });
});

describe("processConversationTurn — complete: true triggers finalization", () => {
  it("calls admin profiles update with voice_complete status when complete is true", async () => {
    const serverChain = makeQueryChain({
      data: { id: sessionId, profile_id: profileId, extracted_data: validExtracted, transcript: "" },
      error: null,
    });
    const adminChain = makeQueryChain({ error: null });
    mockServer(makeClient(serverChain));
    mockAdmin(makeClient(adminChain));

    mockAnthropicCreate.mockResolvedValue(
      claudeProfileDeltaResponse("All done!", {}, { complete: true })
    );

    const result = await processConversationTurn(
      sessionId, profileId, "Yes, that is correct.", [], Date.now() - 60000, mockLog()
    );

    expect(result.complete).toBe(true);
    expect(adminChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ onboarding_status: "voice_complete" })
    );
  });
});

describe("finalizeVoiceSession", () => {
  it("sets status to completed when requires_review is empty", async () => {
    const serverChain = makeQueryChain({ error: null });
    const adminChain = makeQueryChain({ error: null });
    mockServer(makeClient(serverChain));
    mockAdmin(makeClient(adminChain));

    await finalizeVoiceSession(sessionId, profileId, validExtracted, "transcript", 120, mockLog());

    expect(serverChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "completed" })
    );
  });

  it("sets status to needs_review when requires_review is non-empty", async () => {
    const serverChain = makeQueryChain({ error: null });
    const adminChain = makeQueryChain({ error: null });
    mockServer(makeClient(serverChain));
    mockAdmin(makeClient(adminChain));

    const withReview: VoiceExtractedProfile = { ...validExtracted, requires_review: ["nationality"] };
    await finalizeVoiceSession(sessionId, profileId, withReview, "transcript", 90, mockLog());

    expect(serverChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "needs_review" })
    );
  });

  it("throws DatabaseError when the voice_sessions update fails", async () => {
    const serverChain = makeQueryChain({ error: { message: "update failed" } });
    mockServer(makeClient(serverChain));

    await expect(
      finalizeVoiceSession(sessionId, profileId, validExtracted, "transcript", 90, mockLog())
    ).rejects.toThrow(DatabaseError);
  });
});

describe("validateExtractedProfile", () => {
  it("returns the profile when data is valid", () => {
    expect(validateExtractedProfile(validExtracted)).toEqual(validExtracted);
  });

  it("throws ValidationError when required fields are missing (empty object)", () => {
    expect(() => validateExtractedProfile({ full_name: "Jane" })).toThrow(ValidationError);
  });

  it("throws ValidationError when language_proficiency_self has an invalid enum value", () => {
    expect(() =>
      validateExtractedProfile({ ...validExtracted, language_proficiency_self: "beginner" })
    ).toThrow(ValidationError);
  });
});

describe("confirmVoiceProfile", () => {
  it("updates onboarding_status to complete", async () => {
    const adminChain = makeQueryChain({ error: null });
    mockAdmin(makeClient(adminChain));

    await confirmVoiceProfile(profileId, {}, mockLog());

    expect(adminChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ onboarding_status: "complete" })
    );
  });

  it("throws DatabaseError when the update fails", async () => {
    const adminChain = makeQueryChain({ error: { message: "db error" } });
    mockAdmin(makeClient(adminChain));

    await expect(confirmVoiceProfile(profileId, {}, mockLog())).rejects.toThrow(DatabaseError);
  });

  it("uses the admin client to bypass RLS", async () => {
    const adminChain = makeQueryChain({ error: null });
    mockAdmin(makeClient(adminChain));

    await confirmVoiceProfile(profileId, {}, mockLog());

    expect(createSupabaseAdminClient).toHaveBeenCalled();
    expect(createSupabaseServerClient).not.toHaveBeenCalled();
  });
});
