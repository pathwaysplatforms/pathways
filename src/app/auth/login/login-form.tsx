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

        <p className="text-[13px]" style={{ color: "var(--pw-muted)" }}>
          We&apos;ll send you a secure, passwordless sign-in link.
        </p>
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
          className="pw-focus w-full py-3 rounded-full text-sm border transition-colors duration-150"
          style={{
            borderColor: "rgba(0,0,0,0.12)",
            color: "var(--pw-ink)",
            background: "transparent",
            fontFamily: "var(--pw-font-ui)",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--pw-ink)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(0,0,0,0.12)"; }}
        >
          Continue with Google
        </button>
      </form>

      {process.env.NEXT_PUBLIC_DEMO_ENABLED === "true" && (
        <>
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
          <a
            href="/auth/demo"
            className="pw-focus flex items-center justify-center w-full py-3 text-sm rounded-full border transition-colors duration-150"
            style={{
              borderColor: "rgba(0,0,0,0.08)",
              color: "var(--pw-muted)",
              fontFamily: "var(--pw-font-ui)",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "var(--pw-ink)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "var(--pw-muted)"; }}
          >
            Demo login
          </a>
        </>
      )}
    </div>
  );
}
