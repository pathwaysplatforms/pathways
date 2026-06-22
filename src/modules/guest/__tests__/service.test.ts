import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Supabase admin mock ──────────────────────────────────────────────────────
const selectMock = vi.fn();
const insertMock = vi.fn();
const updateMock = vi.fn();
const eqMock = vi.fn();
const gtMock = vi.fn();
const singleMock = vi.fn();

const queryBuilder = {
  select: selectMock,
  insert: insertMock,
  update: updateMock,
  eq: eqMock,
  gt: gtMock,
  single: singleMock,
};

// Make each builder method return the same builder so chains work
beforeEach(() => {
  selectMock.mockReturnValue(queryBuilder);
  insertMock.mockReturnValue(queryBuilder);
  updateMock.mockReturnValue(queryBuilder);
  eqMock.mockReturnValue(queryBuilder);
  gtMock.mockReturnValue(queryBuilder);
});

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({
    from: () => queryBuilder,
  }),
}));

const mockLog = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

import {
  createGuestSession,
  getGuestSession,
  updateGuestOnboardingData,
  saveGuestPathwayResults,
  migrateGuestSession,
} from "../service";
import { DatabaseError, NotFoundError, ValidationError } from "@/lib/errors";

// ─── createGuestSession ───────────────────────────────────────────────────────
describe("createGuestSession", () => {
  it("creates a session and returns it", async () => {
    const mockSession = {
      id: "row-1",
      session_token: "abc-token",
      onboarding_data: {},
      pathway_results: null,
      created_at: "2026-06-16T00:00:00Z",
      expires_at: "2026-06-23T00:00:00Z",
    };
    singleMock.mockResolvedValue({ data: mockSession, error: null });

    const result = await createGuestSession(mockLog as never);
    expect(result.session_token).toBe("abc-token");
    expect(insertMock).toHaveBeenCalled();
  });

  it("throws DatabaseError when insert fails", async () => {
    singleMock.mockResolvedValue({ data: null, error: new Error("DB error") });
    await expect(createGuestSession(mockLog as never)).rejects.toBeInstanceOf(DatabaseError);
  });

  it("logs creation action", async () => {
    const mockSession = { id: "r", session_token: "t", onboarding_data: {}, pathway_results: null, created_at: "", expires_at: "" };
    singleMock.mockResolvedValue({ data: mockSession, error: null });
    await createGuestSession(mockLog as never);
    expect(mockLog.info).toHaveBeenCalledWith(expect.objectContaining({ action: "guest.session.created" }));
  });
});

// ─── getGuestSession ──────────────────────────────────────────────────────────
describe("getGuestSession", () => {
  it("returns the session when found", async () => {
    const mockSession = {
      id: "row-1",
      session_token: "valid-token-123",
      onboarding_data: { full_name: "Jane" },
      pathway_results: null,
      created_at: "2026-06-16T00:00:00Z",
      expires_at: "2026-06-23T00:00:00Z",
    };
    singleMock.mockResolvedValue({ data: mockSession, error: null });

    const result = await getGuestSession("valid-token-123", mockLog as never);
    expect(result.onboarding_data).toEqual({ full_name: "Jane" });
  });

  it("throws NotFoundError when session not found", async () => {
    singleMock.mockResolvedValue({ data: null, error: { code: "PGRST116" } });
    await expect(getGuestSession("missing-token-123", mockLog as never)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("throws ValidationError for obviously invalid token", async () => {
    await expect(getGuestSession("short", mockLog as never)).rejects.toBeInstanceOf(ValidationError);
  });
});

// ─── updateGuestOnboardingData ────────────────────────────────────────────────
describe("updateGuestOnboardingData", () => {
  it("merges new fields with existing data", async () => {
    const existing = {
      id: "r",
      session_token: "tok-123456789",
      onboarding_data: { full_name: "Jane" },
      pathway_results: null,
      created_at: "",
      expires_at: "2099-01-01T00:00:00Z",
    };
    const updated = { ...existing, onboarding_data: { full_name: "Jane", nationality: "Indian" } };
    // First call (getGuestSession internal), second call (update)
    singleMock
      .mockResolvedValueOnce({ data: existing, error: null })
      .mockResolvedValueOnce({ data: updated, error: null });

    const result = await updateGuestOnboardingData("tok-123456789", { nationality: "Indian" }, mockLog as never);
    expect(result.onboarding_data).toEqual({ full_name: "Jane", nationality: "Indian" });
  });

  it("throws DatabaseError when update fails", async () => {
    const existing = { id: "r", session_token: "tok-123456789", onboarding_data: {}, pathway_results: null, created_at: "", expires_at: "2099-01-01T00:00:00Z" };
    singleMock
      .mockResolvedValueOnce({ data: existing, error: null })
      .mockResolvedValueOnce({ data: null, error: new Error("update failed") });

    await expect(updateGuestOnboardingData("tok-123456789", {}, mockLog as never)).rejects.toBeInstanceOf(DatabaseError);
  });

  it("propagates NotFoundError if session is expired", async () => {
    singleMock.mockResolvedValueOnce({ data: null, error: { code: "PGRST116" } });
    await expect(updateGuestOnboardingData("tok-123456789", {}, mockLog as never)).rejects.toBeInstanceOf(NotFoundError);
  });
});

// ─── saveGuestPathwayResults ──────────────────────────────────────────────────
describe("saveGuestPathwayResults", () => {
  it("saves results and returns updated session", async () => {
    const mockResults = { recommendations: [], crs_estimate: null, generated_at: "2026-06-16T00:00:00Z" };
    const updated = { id: "r", session_token: "tok-abc-123456", onboarding_data: {}, pathway_results: mockResults, created_at: "", expires_at: "2099-01-01T00:00:00Z" };
    singleMock.mockResolvedValue({ data: updated, error: null });

    const result = await saveGuestPathwayResults("tok-abc-123456", mockResults as never, mockLog as never);
    expect(result.pathway_results).toEqual(mockResults);
  });

  it("throws DatabaseError when save fails", async () => {
    singleMock.mockResolvedValue({ data: null, error: new Error("DB error") });
    await expect(saveGuestPathwayResults("tok-abc-123456", {} as never, mockLog as never)).rejects.toBeInstanceOf(DatabaseError);
  });

  it("logs results saved action", async () => {
    const updated = { id: "r", session_token: "tok-abc-123456", onboarding_data: {}, pathway_results: {}, created_at: "", expires_at: "2099-01-01T00:00:00Z" };
    singleMock.mockResolvedValue({ data: updated, error: null });
    await saveGuestPathwayResults("tok-abc-123456", {} as never, mockLog as never);
    expect(mockLog.info).toHaveBeenCalledWith(expect.objectContaining({ action: "guest.session.results_saved" }));
  });
});

// ─── migrateGuestSession ──────────────────────────────────────────────────────
describe("migrateGuestSession", () => {
  it("copies guest data to user profile", async () => {
    const session = { id: "r", session_token: "tok-123456789", onboarding_data: { full_name: "Jane" }, pathway_results: null, created_at: "", expires_at: "2099-01-01T00:00:00Z" };
    const profile = { id: "profile-id" };

    singleMock
      .mockResolvedValueOnce({ data: session, error: null })     // getGuestSession
      .mockResolvedValueOnce({ data: profile, error: null });    // profiles select

    // update calls (profiles + expires_at)
    eqMock.mockReturnValue({ ...queryBuilder, then: () => Promise.resolve({ error: null }) });
    updateMock.mockReturnValue({ ...queryBuilder, eq: () => Promise.resolve({ error: null }) });

    await expect(migrateGuestSession("tok-123456789", "auth-user-id", mockLog as never)).resolves.toBeUndefined();
    expect(mockLog.info).toHaveBeenCalledWith(expect.objectContaining({ action: "guest.session.migrated" }));
  });

  it("throws DatabaseError when profile not found", async () => {
    const session = { id: "r", session_token: "tok-123456789", onboarding_data: {}, pathway_results: null, created_at: "", expires_at: "2099-01-01T00:00:00Z" };
    singleMock
      .mockResolvedValueOnce({ data: session, error: null })
      .mockResolvedValueOnce({ data: null, error: new Error("not found") });

    await expect(migrateGuestSession("tok-123456789", "auth-user-id", mockLog as never)).rejects.toBeInstanceOf(DatabaseError);
  });

  it("throws NotFoundError when guest session expired", async () => {
    singleMock.mockResolvedValueOnce({ data: null, error: { code: "PGRST116" } });
    await expect(migrateGuestSession("tok-123456789", "auth-user-id", mockLog as never)).rejects.toBeInstanceOf(NotFoundError);
  });
});
