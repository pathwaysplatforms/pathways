import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Supabase admin mock ──────────────────────────────────────────────────────
const singleMock = vi.fn();
const selectMock = vi.fn();
const updateMock = vi.fn();
const deleteMock = vi.fn();
const eqMock = vi.fn();

const queryBuilder = {
  select: selectMock,
  update: updateMock,
  delete: deleteMock,
  eq: eqMock,
  single: singleMock,
};

beforeEach(() => {
  vi.clearAllMocks();
  selectMock.mockReturnValue(queryBuilder);
  updateMock.mockReturnValue(queryBuilder);
  deleteMock.mockReturnValue(queryBuilder);
  eqMock.mockReturnValue(queryBuilder);
});

const mockDeleteUser = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({
    from: () => queryBuilder,
    auth: { admin: { deleteUser: mockDeleteUser } },
  }),
}));

const mockLog = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

import {
  getAccountProfile,
  updateAccountProfile,
  upgradeSubscription,
  deleteAccount,
} from "../service";
import { NotFoundError, DatabaseError, ValidationError } from "@/lib/errors";

// ─── getAccountProfile ────────────────────────────────────────────────────────
describe("getAccountProfile", () => {
  const mockProfile = {
    id: "profile-1",
    auth_user_id: "user-1",
    full_name: "Alice Smith",
    email: "alice@example.com",
    avatar_url: null,
    preferred_language: "en",
    phone: null,
    nationality: "Canadian",
    country_of_residence: "Canada",
    subscription_status: "free",
    is_admin: false,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };

  it("returns profile on success", async () => {
    singleMock.mockResolvedValueOnce({ data: mockProfile, error: null });
    const result = await getAccountProfile("user-1", mockLog as never);
    expect(result).toEqual(mockProfile);
    expect(mockLog.info).toHaveBeenCalledWith(expect.objectContaining({ action: "account.getProfile.done" }));
  });

  it("throws NotFoundError when profile is missing", async () => {
    singleMock.mockResolvedValueOnce({ data: null, error: null });
    await expect(getAccountProfile("missing-id", mockLog as never)).rejects.toThrow(NotFoundError);
  });

  it("throws NotFoundError on database error", async () => {
    singleMock.mockResolvedValueOnce({ data: null, error: { message: "row not found" } });
    await expect(getAccountProfile("user-1", mockLog as never)).rejects.toThrow(NotFoundError);
  });
});

// ─── updateAccountProfile ─────────────────────────────────────────────────────
describe("updateAccountProfile", () => {
  const updatedProfile = {
    id: "profile-1",
    auth_user_id: "user-1",
    full_name: "Alice Updated",
    email: "alice@example.com",
    avatar_url: null,
    preferred_language: "fr",
    phone: null,
    nationality: null,
    country_of_residence: null,
    subscription_status: "free",
    is_admin: false,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-06-17T00:00:00Z",
  };

  it("returns updated profile on success", async () => {
    singleMock.mockResolvedValueOnce({ data: updatedProfile, error: null });
    const result = await updateAccountProfile(
      "user-1",
      { full_name: "Alice Updated", preferred_language: "fr" },
      mockLog as never
    );
    expect(result.full_name).toBe("Alice Updated");
    expect(result.preferred_language).toBe("fr");
  });

  it("throws ValidationError for invalid preferred_language", async () => {
    await expect(
      updateAccountProfile("user-1", { preferred_language: "english" }, mockLog as never)
    ).rejects.toThrow(ValidationError);
  });

  it("throws ValidationError for invalid phone format", async () => {
    await expect(
      updateAccountProfile("user-1", { phone: "555-1234" }, mockLog as never)
    ).rejects.toThrow(ValidationError);
  });

  it("throws DatabaseError when update fails", async () => {
    singleMock.mockResolvedValueOnce({ data: null, error: { message: "db error" } });
    await expect(
      updateAccountProfile("user-1", { full_name: "Alice" }, mockLog as never)
    ).rejects.toThrow(DatabaseError);
  });
});

// ─── upgradeSubscription ──────────────────────────────────────────────────────
describe("upgradeSubscription", () => {
  it("resolves successfully on upgrade", async () => {
    eqMock.mockResolvedValueOnce({ error: null });
    await expect(upgradeSubscription("user-1", mockLog as never)).resolves.toBeUndefined();
    expect(mockLog.info).toHaveBeenCalledWith(expect.objectContaining({ action: "account.upgradeSubscription.done" }));
  });

  it("throws DatabaseError when update fails", async () => {
    eqMock.mockResolvedValueOnce({ error: { message: "constraint violation" } });
    await expect(upgradeSubscription("user-1", mockLog as never)).rejects.toThrow(DatabaseError);
  });

  it("logs start and done actions", async () => {
    eqMock.mockResolvedValueOnce({ error: null });
    await upgradeSubscription("user-1", mockLog as never);
    expect(mockLog.info).toHaveBeenCalledWith(expect.objectContaining({ action: "account.upgradeSubscription.start" }));
    expect(mockLog.info).toHaveBeenCalledWith(expect.objectContaining({ action: "account.upgradeSubscription.done" }));
  });
});

// ─── deleteAccount ────────────────────────────────────────────────────────────
describe("deleteAccount", () => {
  it("deletes profile and auth user on success", async () => {
    eqMock.mockResolvedValueOnce({ error: null }); // profile delete
    mockDeleteUser.mockResolvedValueOnce({ error: null });
    await expect(deleteAccount("user-1", mockLog as never)).resolves.toBeUndefined();
    expect(mockDeleteUser).toHaveBeenCalledWith("user-1");
  });

  it("throws DatabaseError when profile deletion fails", async () => {
    eqMock.mockResolvedValueOnce({ error: { message: "foreign key violation" } });
    await expect(deleteAccount("user-1", mockLog as never)).rejects.toThrow(DatabaseError);
    expect(mockDeleteUser).not.toHaveBeenCalled();
  });

  it("throws DatabaseError when auth deletion fails", async () => {
    eqMock.mockResolvedValueOnce({ error: null });
    mockDeleteUser.mockResolvedValueOnce({ error: { message: "user not found" } });
    await expect(deleteAccount("user-1", mockLog as never)).rejects.toThrow(DatabaseError);
  });
});
