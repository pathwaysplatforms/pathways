import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Supabase admin mock ──────────────────────────────────────────────────────
const singleMock = vi.fn();
const selectMock = vi.fn();
const updateMock = vi.fn();
const deleteMock = vi.fn();
const eqMock = vi.fn();
const orderMock = vi.fn();
const rangeMock = vi.fn();
const orMock = vi.fn();

const queryBuilder = {
  select: selectMock,
  update: updateMock,
  delete: deleteMock,
  eq: eqMock,
  order: orderMock,
  range: rangeMock,
  or: orMock,
  single: singleMock,
};

// resetAllMocks clears the Once queue between tests so queued returns don't bleed.
beforeEach(() => {
  vi.resetAllMocks();
  selectMock.mockReturnValue(queryBuilder);
  updateMock.mockReturnValue(queryBuilder);
  deleteMock.mockReturnValue(queryBuilder);
  eqMock.mockReturnValue(queryBuilder);
  orderMock.mockReturnValue(queryBuilder);
  orMock.mockReturnValue(queryBuilder);
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
  listUsers,
  updateUserSubscription,
  toggleAdminRole,
  adminDeleteUser,
} from "../adminService";
import { DatabaseError, ValidationError, NotFoundError } from "@/lib/errors";

// ─── listUsers ────────────────────────────────────────────────────────────────
describe("listUsers", () => {
  const mockUsers = [
    {
      id: "p-1",
      auth_user_id: "u-1",
      full_name: "Alice",
      email: "alice@example.com",
      subscription_status: "free",
      is_admin: false,
      created_at: "2026-01-01T00:00:00Z",
      onboarding_step: "complete",
    },
  ];

  it("returns paginated user list", async () => {
    rangeMock.mockResolvedValueOnce({ data: mockUsers, error: null, count: 1 });
    const result = await listUsers(1, "", mockLog as never);
    expect(result.users).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
  });

  it("returns empty list when no users match search", async () => {
    rangeMock.mockResolvedValueOnce({ data: [], error: null, count: 0 });
    const result = await listUsers(1, "zzznonexistent", mockLog as never);
    expect(result.users).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it("throws DatabaseError on query failure", async () => {
    rangeMock.mockResolvedValueOnce({ data: null, error: { message: "db error" }, count: null });
    await expect(listUsers(1, "", mockLog as never)).rejects.toThrow(DatabaseError);
  });
});

// ─── updateUserSubscription ───────────────────────────────────────────────────
describe("updateUserSubscription", () => {
  it("updates subscription to paid successfully", async () => {
    eqMock.mockResolvedValueOnce({ error: null });
    await expect(
      updateUserSubscription("u-1", "paid", "admin-1", mockLog as never)
    ).resolves.toBeUndefined();
  });

  it("throws ValidationError for invalid status", async () => {
    await expect(
      updateUserSubscription("u-1", "premium", "admin-1", mockLog as never)
    ).rejects.toThrow(ValidationError);
  });

  it("throws DatabaseError when update fails", async () => {
    eqMock.mockResolvedValueOnce({ error: { message: "constraint violation" } });
    await expect(
      updateUserSubscription("u-1", "paid", "admin-1", mockLog as never)
    ).rejects.toThrow(DatabaseError);
  });
});

// ─── toggleAdminRole ──────────────────────────────────────────────────────────
describe("toggleAdminRole", () => {
  it("grants admin role successfully", async () => {
    eqMock.mockResolvedValueOnce({ error: null });
    await expect(
      toggleAdminRole("u-1", true, "admin-1", mockLog as never)
    ).resolves.toBeUndefined();
  });

  it("throws ValidationError when admin tries to modify own role", async () => {
    await expect(
      toggleAdminRole("admin-1", false, "admin-1", mockLog as never)
    ).rejects.toThrow(ValidationError);
  });

  it("throws DatabaseError on update failure", async () => {
    eqMock.mockResolvedValueOnce({ error: { message: "row locked" } });
    await expect(
      toggleAdminRole("u-1", true, "admin-1", mockLog as never)
    ).rejects.toThrow(DatabaseError);
  });
});

// ─── adminDeleteUser ──────────────────────────────────────────────────────────
describe("adminDeleteUser", () => {
  it("deletes user profile and auth record", async () => {
    // select chain: eq() → queryBuilder → single() → profile exists
    eqMock.mockReturnValueOnce(queryBuilder);
    singleMock.mockResolvedValueOnce({ data: { id: "p-1" }, error: null });
    // delete chain: eq() → direct result
    eqMock.mockResolvedValueOnce({ error: null });
    mockDeleteUser.mockResolvedValueOnce({ error: null });
    await expect(
      adminDeleteUser("u-1", "admin-1", mockLog as never)
    ).resolves.toBeUndefined();
    expect(mockDeleteUser).toHaveBeenCalledWith("u-1");
  });

  it("throws ValidationError when admin tries to delete own account", async () => {
    await expect(
      adminDeleteUser("admin-1", "admin-1", mockLog as never)
    ).rejects.toThrow(ValidationError);
  });

  it("throws NotFoundError when target user does not exist", async () => {
    // eq() uses default (queryBuilder), single() returns null data
    singleMock.mockResolvedValueOnce({ data: null, error: { message: "not found" } });
    await expect(
      adminDeleteUser("u-missing", "admin-1", mockLog as never)
    ).rejects.toThrow(NotFoundError);
  });

  it("throws DatabaseError when profile deletion fails", async () => {
    // select chain succeeds
    eqMock.mockReturnValueOnce(queryBuilder);
    singleMock.mockResolvedValueOnce({ data: { id: "p-1" }, error: null });
    // delete chain fails
    eqMock.mockResolvedValueOnce({ error: { message: "constraint violation" } });
    await expect(
      adminDeleteUser("u-1", "admin-1", mockLog as never)
    ).rejects.toThrow(DatabaseError);
    expect(mockDeleteUser).not.toHaveBeenCalled();
  });
});
