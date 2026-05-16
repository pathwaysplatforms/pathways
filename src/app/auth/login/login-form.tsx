"use client";

import { useState, useTransition } from "react";
import { signInWithEmailAction, signInWithGoogleAction } from "./actions";

interface LoginFormProps {
  hasError: boolean;
}

export function LoginForm({ hasError }: LoginFormProps) {
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
      <p className="text-sm text-neutral-800 leading-relaxed text-center">
        Check your inbox — we&apos;ve sent a sign-in link to{" "}
        <span className="font-medium">{sentToEmail}</span>.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {hasError && (
        <div className="bg-danger-bg border border-red-200 rounded-md px-4 py-3">
          <p className="text-sm text-danger">
            We could not sign you in. Please try again.
          </p>
        </div>
      )}

      <form onSubmit={handleEmailSubmit} className="space-y-3">
        <div className="space-y-1.5">
          <label
            htmlFor="email"
            className="block text-[11px] font-medium uppercase tracking-wide text-neutral-400"
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
            className="w-full h-10 border border-neutral-200 rounded-md px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand disabled:opacity-50 transition-colors"
          />
        </div>

        {formError && (
          <p className="text-danger text-[13px] mt-1">{formError}</p>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="w-full h-10 px-4 text-sm font-medium bg-brand text-white rounded-md hover:bg-brand-dark transition-colors disabled:opacity-50"
        >
          {isPending ? "Sending…" : "Continue with email"}
        </button>

        <p className="text-[13px] text-neutral-600">
          We&apos;ll send you a secure sign-in link.
        </p>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-neutral-200" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-white px-3 text-[13px] text-neutral-400">or</span>
        </div>
      </div>

      <form action={signInWithGoogleAction}>
        <button
          type="submit"
          className="w-full h-10 px-4 text-sm font-medium border border-neutral-200 rounded-md hover:border-neutral-300 transition-colors"
        >
          Continue with Google
        </button>
      </form>
    </div>
  );
}
