"use client";

import { useState } from "react";
import { deleteAccountAction } from "@/app/account/actions";

/** Section E: permanent account deletion with confirmation gate. */
export function AccountDangerZone() {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      await deleteAccountAction();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete account.");
      setDeleting(false);
      setConfirming(false);
    }
  }

  return (
    <section
      className="card"
      style={{ padding: 24, borderColor: "rgba(220,38,38,0.2)" }}
    >
      <h2
        style={{
          fontFamily: "var(--pw-font-body)",
          fontSize: 15,
          fontWeight: 500,
          color: "#dc2626",
          marginBottom: 12,
        }}
      >
        Danger zone
      </h2>

      <p style={{ fontSize: 13, color: "var(--pw-muted)", fontFamily: "var(--pw-font-body)", lineHeight: 1.6, marginBottom: 16 }}>
        Permanently delete your Pathways account and all associated data.
        This action cannot be undone.
      </p>

      {error && (
        <p style={{ fontSize: 13, color: "#dc2626", fontFamily: "var(--pw-font-body)", marginBottom: 12 }}>
          {error}
        </p>
      )}

      {!confirming ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          style={{
            fontSize: 13,
            fontFamily: "var(--pw-font-body)",
            color: "#dc2626",
            background: "none",
            border: "1px solid rgba(220,38,38,0.4)",
            borderRadius: 8,
            padding: "7px 14px",
            cursor: "pointer",
          }}
        >
          Delete account
        </button>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            style={{
              fontSize: 13,
              fontFamily: "var(--pw-font-body)",
              color: "#fff",
              background: "#dc2626",
              border: "none",
              borderRadius: 8,
              padding: "7px 14px",
              cursor: deleting ? "not-allowed" : "pointer",
              opacity: deleting ? 0.7 : 1,
            }}
          >
            {deleting ? "Deleting…" : "Yes, delete my account"}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={deleting}
            style={{
              fontSize: 13,
              fontFamily: "var(--pw-font-body)",
              color: "var(--pw-muted)",
              background: "none",
              border: "1px solid var(--pw-border)",
              borderRadius: 8,
              padding: "7px 14px",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
        </div>
      )}
    </section>
  );
}
