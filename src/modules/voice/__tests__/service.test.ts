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

const validExtracted: VoiceExtractedProfile = {
  full_name: "Jane Doe",
  nationality: "French",
  current_country: "United Kingdom",
  occupation: "Software Engineer",
  years_experience: 5,
  has_degree: true,
  degree_level: "master",
  degree_field: "Computer Science",
  annual_salary_gbp: 70000,
  has_criminal_record: false,
  english_level: "fluent",
  marital_status: "single",
  has_dependents: false,
  requires_review: [],
};

function anthropicResponse(json: object) {
  return { content: [{ type: "text", text: JSON.stringify(json) }] };
}

function validTurnJson(overrides: object = {}) {
  return {
    message: "What is your nationality?",
    delta: { nationality: "French" },
    complete: false,
    requires_review: [],
    ...overrides,
  };
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

describe("processConversationTurn — delta merging", () => {
  it("merges delta correctly across multiple fields", async () => {
    const existingData = { full_name: "Jane", requires_review: [] };
    const chain = makeQueryChain({
      data: {
        id: sessionId,
        profile_id: profileId,
        extracted_data: existingData,
        transcript: "",
      },
      error: null,
    });
    mockServer(makeClient(chain));

    mockAnthropicCreate.mockResolvedValue(
      anthropicResponse(validTurnJson({ delta: { nationality: "French" } }))
    );

    const result = await processConversationTurn(
      sessionId,
      profileId,
      "My name is Jane",
      [],
      Date.now() - 5000,
      mockLog()
    );

    expect(result.message).toBe("What is your nationality?");
    expect(result.complete).toBe(false);
    expect(result.audioBase64).toBeTruthy();

    const updateCall = chain.update.mock.calls[0][0] as {
      extracted_data: { full_name: string; nationality: string };
    };
    expect(updateCall.extracted_data.full_name).toBe("Jane");
    expect(updateCall.extracted_data.nationality).toBe("French");
  });

  it("accumulates requires_review fields across turns", async () => {
    const existingData = { full_name: "Jane", requires_review: ["nationality"] };
    const chain = makeQueryChain({
      data: {
        id: sessionId,
        profile_id: profileId,
        extracted_data: existingData,
        transcript: "",
      },
      error: null,
    });
    mockServer(makeClient(chain));

    mockAnthropicCreate.mockResolvedValue(
      anthropicResponse(
        validTurnJson({ delta: { current_country: "UK" }, requires_review: ["current_country"] })
      )
    );

    await processConversationTurn(
      sessionId,
      profileId,
      "I live in the UK",
      [],
      Date.now(),
      mockLog()
    );

    const updateCall = chain.update.mock.calls[0][0] as {
      extracted_data: { requires_review: string[] };
    };
    expect(updateCall.extracted_data.requires_review).toContain("nationality");
    expect(updateCall.extracted_data.requires_review).toContain("current_country");
  });
});

describe("processConversationTurn — Zod validation", () => {
  it("throws ValidationError when Claude returns malformed JSON", async () => {
    const chain = makeQueryChain({
      data: { id: sessionId, profile_id: profileId, extracted_data: {}, transcript: "" },
      error: null,
    });
    mockServer(makeClient(chain));

    mockAnthropicCreate.mockResolvedValue({
      content: [{ type: "text", text: "not json at all" }],
    });

    await expect(
      processConversationTurn(sessionId, profileId, "hello", [], Date.now(), mockLog())
    ).rejects.toThrow(ValidationError);
  });

  it("throws ValidationError when Claude response fails the schema", async () => {
    const chain = makeQueryChain({
      data: { id: sessionId, profile_id: profileId, extracted_data: {}, transcript: "" },
      error: null,
    });
    mockServer(makeClient(chain));

    mockAnthropicCreate.mockResolvedValue(anthropicResponse({ wrong_field: true }));

    await expect(
      processConversationTurn(sessionId, profileId, "hello", [], Date.now(), mockLog())
    ).rejects.toThrow(ValidationError);
  });

  it("throws DatabaseError when session is not found", async () => {
    const chain = makeQueryChain({ data: null, error: { message: "no rows" } });
    mockServer(makeClient(chain));

    await expect(
      processConversationTurn(sessionId, profileId, "hello", [], Date.now(), mockLog())
    ).rejects.toThrow(DatabaseError);
  });
});

describe("processConversationTurn — complete: true triggers finalization", () => {
  it("calls admin profiles update when complete is true", async () => {
    const serverChain = makeQueryChain({
      data: {
        id: sessionId,
        profile_id: profileId,
        extracted_data: validExtracted,
        transcript: "",
      },
      error: null,
    });
    const adminChain = makeQueryChain({ error: null });
    mockServer(makeClient(serverChain));
    mockAdmin(makeClient(adminChain));

    mockAnthropicCreate.mockResolvedValue(
      anthropicResponse({
        message: "All done.",
        delta: {},
        complete: true,
        requires_review: [],
      })
    );

    const result = await processConversationTurn(
      sessionId,
      profileId,
      "Yes, that is correct.",
      [],
      Date.now() - 60000,
      mockLog()
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

  it("throws ValidationError when required fields are missing", () => {
    expect(() => validateExtractedProfile({ full_name: "Jane" })).toThrow(ValidationError);
  });

  it("throws ValidationError when degree_level has an invalid enum value", () => {
    expect(() =>
      validateExtractedProfile({ ...validExtracted, degree_level: "associate" })
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
