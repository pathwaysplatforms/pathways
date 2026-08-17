"use client";

import { useState, useTransition } from "react";
import { signInWithEmailAction, signInWithGoogleAction } from "./actions";

interface LoginFormProps {
  errorMessage: string | null;
}

/** Passwordless email + Google OAuth form — underline-only input style. */
export function LoginForm({ errorMessage }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [sentToEmail, setSentToEmail] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleEmailSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    startTransition(async () => {
      const result = await signInWithEmailAction(email);
      if (result.success) {
        setSentToEmail(email);
        setSent(true);
      } else {
        setFormError(result.error);
      }
    });
  }

  if (sent) {
    return (
      <p
        className="text-sm leading-relaxed text-center"
        style={{ color: "var(--pw-ink)", fontFamily: "var(--pw-font-body)" }}
      >
        Check your inbox — we&apos;ve sent a sign-in link to{" "}
        <span style={{ fontFamily: "var(--pw-font-display)" }}>{sentToEmail}</span>.
      </p>
    );
  }

  return (
    <div className="space-y-8" style={{ fontFamily: "var(--pw-font-body)" }}>
      {(errorMessage ?? formError) && (
        <div className="px-4 py-3 border border-black/[0.08] rounded">
          <p className="text-sm" style={{ color: "var(--pw-muted)" }}>
            {errorMessage ?? formError}
          </p>
        </div>
      )}

      <form onSubmit={handleEmailSubmit} className="space-y-6">
        <div className="space-y-2">
          <label
            htmlFor="email"
            className="block text-[11px] uppercase tracking-widest"
            style={{ color: "var(--pw-muted)", fontFamily: "var(--pw-font-ui)" }}
          >
            Email address
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isPending}
            className="w-full pb-2 bg-transparent border-0 border-b focus:outline-none focus:ring-0 text-sm disabled:opacity-50 transition-colors duration-150"
            style={{
              borderBottomColor: "rgba(0,0,0,0.2)",
              color: "var(--pw-ink)",
            }}
            onFocus={(e) => { e.currentTarget.style.borderBottomColor = "var(--pw-ink)"; }}
            onBlur={(e)  => { e.currentTarget.style.borderBottomColor = "rgba(0,0,0,0.2)"; }}
          />
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="pw-focus w-full py-3 rounded-full text-sm disabled:opacity-50 transition-colors duration-150"
          style={{ background: "var(--pw-ink)", color: "#FFFFFF", fontFamily: "var(--pw-font-ui)" }}
          onMouseEnter={(e) => { if (!isPending) (e.currentTarget as HTMLButtonElement).style.background = "var(--pw-accent)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--pw-ink)"; }}
        >
          {isPending ? "Sending…" : "Continue with email"}
        </button>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full" style={{ borderTop: "1px solid rgba(0,0,0,0.08)" }} />
        </div>
        <div className="relative flex justify-center">
          <span
            className="px-3 text-[13px]"
            style={{ background: "var(--pw-bg)", color: "var(--pw-muted)" }}
          >
            or
          </span>
        </div>
      </div>

      <form action={signInWithGoogleAction}>
        <button
          type="submit"
          className="pw-focus flex items-center justify-center gap-3 w-full py-3 rounded-full text-sm transition-shadow duration-150"
          style={{
            border: "1px solid #DADCE0",
            color: "#3C4043",
            background: "#FFFFFF",
            fontFamily: "var(--pw-font-ui)",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 1px 2px rgba(0,0,0,0.12)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.boxShadow = "none"; }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62Z"
            />
            <path
              fill="#34A853"
              d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.95v2.33A9 9 0 0 0 9 18Z"
            />
            <path
              fill="#FBBC05"
              d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.95A9 9 0 0 0 0 9c0 1.45.35 2.83.95 4.03l3-2.33Z"
            />
            <path
              fill="#EA4335"
              d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .95 4.97l3 2.33C4.66 5.17 6.65 3.58 9 3.58Z"
            />
          </svg>
          Continue with Google
        </button>
      </form>

      {process.env.NEXT_PUBLIC_DEMO_ENABLED === "true" && (
        <a
          href="/auth/demo"
          className="pw-focus block text-center text-[13px] transition-colors duration-150"
          style={{ color: "var(--pw-muted)", fontFamily: "var(--pw-font-ui)" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "var(--pw-ink)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "var(--pw-muted)"; }}
        >
          Demo login
        </a>
      )}
    </div>
  );
}
