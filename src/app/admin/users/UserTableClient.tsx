"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AdminUsersResult, AdminUserRow } from "@/modules/account/types";
import {
  updateSubscriptionAction,
  toggleAdminAction,
  deleteUserAction,
} from "./actions";

interface Props {
  initialResult: AdminUsersResult;
  currentSearch: string;
  currentAdminId: string;
}

const STATUS_OPTIONS = ["guest", "free", "paid"] as const;

/** Interactive user management table. Server data is passed as initial props; actions revalidate. */
export function UserTableClient({ initialResult, currentSearch, currentAdminId }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState(currentSearch);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const { users, total, page, pageSize } = initialResult;
  const totalPages = Math.ceil(total / pageSize);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    router.push(`/admin/users?search=${encodeURIComponent(search)}&page=1`);
  }

  async function handleSubscriptionChange(userId: string, status: string) {
    setActionError(null);
    startTransition(async () => {
      const result = await updateSubscriptionAction(userId, status);
      if (result.error) setActionError(result.error.message);
    });
  }

  async function handleToggleAdmin(userId: string, grant: boolean) {
    setActionError(null);
    startTransition(async () => {
      const result = await toggleAdminAction(userId, grant);
      if (result.error) setActionError(result.error.message);
    });
  }

  async function handleDelete(user: AdminUserRow) {
    const confirmed = confirm(
      `Delete ${user.full_name ?? user.email ?? "this user"}? This cannot be undone.`
    );
    if (!confirmed) return;
    setActionError(null);
    startTransition(async () => {
      const result = await deleteUserAction(user.auth_user_id);
      if (result.error) setActionError(result.error.message);
    });
  }

  return (
    <div>
      {/* Search bar */}
      <form onSubmit={handleSearch} style={{ marginBottom: 16, display: "flex", gap: 8 }}>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email…"
          className="text-sm border border-border rounded-md px-3 py-2 text-text-primary bg-bg-surface"
          style={{ flex: 1 }}
        />
        <button
          type="submit"
          className="btn-primary text-sm px-4 py-2 rounded-md"
          style={{ fontFamily: "var(--pw-font-body)" }}
        >
          Search
        </button>
      </form>

      {actionError && (
        <div className="mb-4 p-3 rounded-md bg-red-50 text-red-700 text-sm border border-red-200">
          {actionError}
        </div>
      )}

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, fontFamily: "var(--pw-font-body)" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--pw-border)", backgroundColor: "rgba(0,0,0,0.02)" }}>
              <Th>Name / Email</Th>
              <Th>Joined</Th>
              <Th>Status</Th>
              <Th>Admin</Th>
              <Th>Onboarding</Th>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: "32px 16px", textAlign: "center", color: "var(--pw-muted)" }}>
                  No users found.
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr
                  key={user.id}
                  style={{ borderBottom: "1px solid var(--pw-border)", opacity: isPending ? 0.6 : 1 }}
                >
                  <td style={{ padding: "12px 16px" }}>
                    <p style={{ fontWeight: 500, color: "var(--pw-ink)", marginBottom: 2 }}>
                      {user.full_name ?? "—"}
                    </p>
                    <p style={{ color: "var(--pw-muted)", fontSize: 12 }}>{user.email ?? "—"}</p>
                  </td>
                  <td style={{ padding: "12px 16px", color: "var(--pw-muted)" }}>
                    {new Date(user.created_at).toLocaleDateString("en-CA")}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <select
                      value={user.subscription_status}
                      onChange={(e) => handleSubscriptionChange(user.auth_user_id, e.target.value)}
                      disabled={isPending}
                      style={{
                        fontSize: 12,
                        fontFamily: "var(--pw-font-body)",
                        border: "1px solid var(--pw-border)",
                        borderRadius: 6,
                        padding: "4px 8px",
                        backgroundColor: "#fff",
                        cursor: "pointer",
                      }}
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    {user.auth_user_id === currentAdminId ? (
                      <span style={{ fontSize: 12, color: "var(--pw-muted)" }}>you</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleToggleAdmin(user.auth_user_id, !user.is_admin)}
                        disabled={isPending}
                        style={{
                          fontSize: 12,
                          fontFamily: "var(--pw-font-body)",
                          padding: "4px 10px",
                          borderRadius: 6,
                          border: user.is_admin ? "1px solid var(--pw-accent)" : "1px solid var(--pw-border)",
                          backgroundColor: user.is_admin ? "rgba(20,144,156,0.08)" : "transparent",
                          color: user.is_admin ? "var(--pw-accent)" : "var(--pw-muted)",
                          cursor: isPending ? "not-allowed" : "pointer",
                        }}
                      >
                        {user.is_admin ? "Admin" : "User"}
                      </button>
                    )}
                  </td>
                  <td style={{ padding: "12px 16px", color: "var(--pw-muted)", fontSize: 12 }}>
                    {user.onboarding_step ?? "—"}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    {user.auth_user_id !== currentAdminId && (
                      <button
                        type="button"
                        onClick={() => handleDelete(user)}
                        disabled={isPending}
                        style={{
                          fontSize: 12,
                          fontFamily: "var(--pw-font-body)",
                          color: "#dc2626",
                          background: "none",
                          border: "1px solid rgba(220,38,38,0.3)",
                          borderRadius: 6,
                          padding: "4px 10px",
                          cursor: isPending ? "not-allowed" : "pointer",
                        }}
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ marginTop: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p style={{ fontSize: 13, color: "var(--pw-muted)", fontFamily: "var(--pw-font-body)" }}>
            Page {page} of {totalPages}
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            {page > 1 && (
              <a
                href={`/admin/users?search=${encodeURIComponent(currentSearch)}&page=${page - 1}`}
                className="text-sm text-text-secondary border border-border rounded-md px-3 py-1.5 hover:text-text-primary transition-colors"
                style={{ fontFamily: "var(--pw-font-body)" }}
              >
                ← Previous
              </a>
            )}
            {page < totalPages && (
              <a
                href={`/admin/users?search=${encodeURIComponent(currentSearch)}&page=${page + 1}`}
                className="text-sm text-text-secondary border border-border rounded-md px-3 py-1.5 hover:text-text-primary transition-colors"
                style={{ fontFamily: "var(--pw-font-body)" }}
              >
                Next →
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      style={{
        padding: "10px 16px",
        textAlign: "left",
        fontSize: 12,
        fontWeight: 500,
        color: "var(--pw-muted)",
        fontFamily: "var(--pw-font-body)",
        letterSpacing: "0.02em",
      }}
    >
      {children}
    </th>
  );
}
