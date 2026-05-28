"use client";

import { useState, useTransition } from "react";
import { signInWithEmailAction, signInWithGoogleAction } from "./actions";

interface LoginFormProps {
  errorMessage: string | null;
}

/** Passwordless email + Google OAuth form. */
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
      <p className="text-sm text-text-primary leading-relaxed text-center">
        Check your inbox — we&apos;ve sent a sign-in link to{" "}
        <span className="font-medium text-text-primary">{sentToEmail}</span>.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {errorMessage && (
        <div className="bg-status-warning-bg border border-status-warning-border rounded-badge px-4 py-3">
          <p className="text-sm text-status-warning-text">{errorMessage}</p>
        </div>
      )}

      <form onSubmit={handleEmailSubmit} className="space-y-3">
        <div className="space-y-1.5">
          <label
            htmlFor="email"
            className="block text-[11px] font-medium uppercase tracking-wide text-text-tertiary"
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
            className="w-full h-10 border border-border rounded-input px-3 text-sm text-text-primary bg-bg-subtle focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500 disabled:opacity-50 transition-colors"
          />
        </div>

        {formError && (
          <p className="text-status-warning-text text-[13px] mt-1">{formError}</p>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="btn-primary w-full disabled:opacity-50"
        >
          {isPending ? "Sending…" : "Continue with email"}
        </button>

        <p className="text-[13px] text-text-secondary">
          We&apos;ll send you a secure, passwordless sign-in link.
        </p>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border-light" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-bg-surface px-3 text-[13px] text-text-tertiary">or</span>
        </div>
      </div>

      <form action={signInWithGoogleAction}>
        <button
          type="submit"
          className="btn-secondary w-full"
        >
          Continue with Google
        </button>
      </form>

      {process.env.NEXT_PUBLIC_DEMO_ENABLED === "true" && (
        <>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border-light" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-bg-surface px-3 text-[13px] text-text-tertiary">or</span>
            </div>
          </div>
          <a
            href="/auth/demo"
            className="flex items-center justify-center w-full h-10 px-4 text-sm font-medium bg-accent-50 text-accent-700 border border-accent-200 rounded-btn hover:bg-accent-100 transition-colors"
          >
            Demo login
          </a>
        </>
      )}
    </div>
  );
}
