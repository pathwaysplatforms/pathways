"use client";

import { useState } from "react";
import { signInWithEmail } from "@/modules/auth/service";

interface Props {
  email: string | null;
}

/** Section D: magic link re-auth and connected account info. */
export function AccountSecuritySection({ email }: Props) {
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSendMagicLink() {
    if (!email) return;
    setSending(true);
    setError(null);
    try {
      await signInWithEmail(email);
      setSent(true);
    } catch {
      setError("Could not send link. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="card" style={{ padding: 24 }}>
      <h2
        style={{
          fontFamily: "var(--pw-font-body)",
          fontSize: 15,
          fontWeight: 500,
          color: "var(--pw-ink)",
          marginBottom: 20,
        }}
      >
        Security
      </h2>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Email / magic link */}
        <div>
          <p style={{ fontSize: 13, fontWeight: 500, color: "var(--pw-ink)", fontFamily: "var(--pw-font-body)", marginBottom: 4 }}>
            Sign-in email
          </p>
          <p style={{ fontSize: 14, color: "var(--pw-muted)", fontFamily: "var(--pw-font-body)", marginBottom: 10 }}>
            {email ?? "No email on record"}
          </p>

          {email && (
            sent ? (
              <p style={{ fontSize: 13, color: "var(--pw-accent)", fontFamily: "var(--pw-font-body)" }}>
                Magic link sent — check your inbox.
              </p>
            ) : (
              <button
                type="button"
                onClick={handleSendMagicLink}
                disabled={sending}
                style={{
                  fontSize: 13,
                  fontFamily: "var(--pw-font-body)",
                  color: "var(--pw-ink)",
                  background: "none",
                  border: "1px solid var(--pw-border)",
                  borderRadius: 8,
                  padding: "7px 14px",
                  cursor: sending ? "not-allowed" : "pointer",
                  opacity: sending ? 0.6 : 1,
                }}
              >
                {sending ? "Sending…" : "Send magic link"}
              </button>
            )
          )}

          {error && (
            <p style={{ fontSize: 13, color: "#dc2626", fontFamily: "var(--pw-font-body)", marginTop: 8 }}>
              {error}
            </p>
          )}
        </div>

        <hr style={{ border: "none", borderTop: "1px solid var(--pw-border)" }} />

        {/* Auth method note */}
        <div>
          <p style={{ fontSize: 13, fontWeight: 500, color: "var(--pw-ink)", fontFamily: "var(--pw-font-body)", marginBottom: 4 }}>
            Sign-in method
          </p>
          <p style={{ fontSize: 13, color: "var(--pw-muted)", fontFamily: "var(--pw-font-body)", lineHeight: 1.6 }}>
            Pathways uses passwordless sign-in via magic link or Google OAuth.
            No password is stored for your account.
          </p>
        </div>
      </div>
    </section>
  );
}
