"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { clearGuestToken } from "@/lib/guest-session";

interface Props {
  guestToken: string;
  onClose: () => void;
}

type View = "choice" | "email" | "email_sent";

/** Inline modal for saving guest pathway results — email+password or Google OAuth. */
export function SaveResultsModal({ guestToken, onClose }: Props) {
  const router = useRouter();
  const [view, setView] = useState<View>("choice");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputClass = "w-full h-10 border border-border rounded-input px-3 text-sm text-text-primary placeholder:text-text-disabled focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500 bg-bg-surface transition-colors";

  async function handleEmailSignup(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    setLoading(true);
    setError(null);

    const supabase = createSupabaseBrowserClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?guest_token=${guestToken}`,
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    // If the user already exists and was immediately signed in, migrate now
    if (data.session) {
      const migrateRes = await fetch("/api/auth/migrate-guest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guest_token: guestToken }),
      });

      if (migrateRes.ok) {
        clearGuestToken();
        router.push("/dashboard?welcome=1");
        return;
      }
    }

    // Otherwise, email confirmation is required
    setView("email_sent");
    setLoading(false);
  }

  async function handleGoogleSignup() {
    const supabase = createSupabaseBrowserClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?guest_token=${guestToken}`,
      },
    });
    if (oauthError) setError(oauthError.message);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }}>
      <div
        className="relative w-full max-w-md bg-bg-surface rounded-panel p-8"
        style={{ boxShadow: "var(--shadow-card-lg)" }}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-text-tertiary hover:text-text-secondary transition-colors"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        {view === "choice" && (
          <>
            <h2 className="font-bold text-text-primary text-lg mb-1">Save your results</h2>
            <p className="text-text-secondary text-sm mb-6">
              Create a free account to save your pathway matches and get step-by-step guidance.
            </p>

            {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

            <button
              onClick={() => void handleGoogleSignup()}
              className="w-full flex items-center justify-center gap-3 h-10 rounded-btn border border-border text-sm text-text-primary hover:bg-bg-subtle transition-colors mb-3"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>

            <div className="flex items-center gap-3 mb-3">
              <hr className="flex-1 border-border" />
              <span className="text-xs text-text-tertiary">or</span>
              <hr className="flex-1 border-border" />
            </div>

            <button
              onClick={() => setView("email")}
              className="btn-primary w-full py-2.5 text-sm"
            >
              Sign up with email
            </button>

            <p className="mt-4 text-center text-xs text-text-tertiary">
              Already have an account?{" "}
              <a href={`/auth/login`} className="underline underline-offset-2 text-accent-600 hover:text-accent-700">
                Sign in
              </a>
            </p>
          </>
        )}

        {view === "email" && (
          <>
            <button
              onClick={() => setView("choice")}
              className="text-xs text-text-tertiary hover:text-text-secondary underline underline-offset-2 mb-4 transition-colors"
            >
              ← Back
            </button>
            <h2 className="font-bold text-text-primary text-lg mb-1">Create your account</h2>
            <p className="text-text-secondary text-sm mb-6">Your pathway results will be saved automatically.</p>

            {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

            <form onSubmit={(e) => void handleEmailSignup(e)} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-tertiary uppercase tracking-wide mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  className={inputClass}
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-tertiary uppercase tracking-wide mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  minLength={8}
                  className={inputClass}
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <button
                type="submit"
                disabled={loading || !email.trim() || password.length < 8}
                className="btn-primary w-full py-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Creating account…" : "Create account & save results"}
              </button>
            </form>
          </>
        )}

        {view === "email_sent" && (
          <div className="text-center py-4">
            <div className="w-12 h-12 rounded-full bg-status-success-bg flex items-center justify-center mx-auto mb-4">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="M16.667 5L7.5 14.167 3.333 10" stroke="#0B7269" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h2 className="font-bold text-text-primary text-lg mb-2">Check your email</h2>
            <p className="text-text-secondary text-sm">
              We sent a confirmation link to <strong>{email}</strong>. Click it to finish creating your account — your pathway results will be saved automatically.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
