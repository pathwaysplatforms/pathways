"use client";

import Link from "next/link";
import { Mic, FileText, ArrowLeft } from "lucide-react";

/** Welcome screen shown to unauthenticated (and not-started) visitors at /onboarding. */
export function GuestOnboardingIntro() {
  return (
    <div
      className="relative min-h-screen flex flex-col overflow-hidden"
      style={{ backgroundColor: "#0D4A3A", fontFamily: "var(--pw-font-body)" }}
    >
      {/* Topographic texture */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: "url('/textures/topo-lines.svg')",
          backgroundRepeat: "repeat",
          backgroundSize: "600px 600px",
          opacity: 0.07,
        }}
      />

      {/* Grain */}
      <div className="pw-grain" aria-hidden="true" />

      {/* Header */}
      <header className="relative z-10 flex items-center px-8 py-6" style={{ gap: 0 }}>
        {/* Back to marketing website */}
        <a
          href={process.env.NEXT_PUBLIC_MARKETING_URL ?? "http://localhost:3001"}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            color: "rgba(255,255,255,0.45)", fontSize: 14, textDecoration: "none",
            transition: "color 0.15s ease",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.9)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.45)"; }}
        >
          <ArrowLeft size={15} />
          Back
        </a>

        {/* Wordmark — centered */}
        <span
          style={{
            position: "absolute", left: "50%", transform: "translateX(-50%)",
            fontFamily: "var(--pw-font-body)",
            fontWeight: 600,
            fontSize: 17,
            color: "#ffffff",
            letterSpacing: "-0.01em",
          }}
        >
          Pathways
        </span>

        {/* Sign in — pushed to right */}
        <Link
          href="/auth/login"
          style={{ marginLeft: "auto", color: "rgba(255,255,255,0.45)", fontSize: 14, textDecoration: "none" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.9)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.45)"; }}
        >
          Sign in →
        </Link>
      </header>

      {/* Main */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 pb-24 pt-4">
        {/* Eyebrow */}
        <p
          className="mb-5 uppercase tracking-widest"
          style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, fontWeight: 500, letterSpacing: "0.12em" }}
        >
          Immigration pathway matching
        </p>

        {/* Headline */}
        <h1
          className="text-center mb-5"
          style={{
            fontFamily: "var(--pw-font-display)",
            fontWeight: 400,
            fontSize: "clamp(2rem, 5vw, 3.25rem)",
            lineHeight: 1.12,
            letterSpacing: "-0.02em",
            color: "#ffffff",
            maxWidth: "16ch",
          }}
        >
          Find your Canadian immigration pathway
        </h1>

        {/* Subtitle */}
        <p
          className="text-center mb-14"
          style={{
            fontFamily: "var(--pw-font-body)",
            fontSize: 16,
            lineHeight: 1.65,
            color: "rgba(255,255,255,0.55)",
            maxWidth: "38ch",
          }}
        >
          Answer a few questions about your situation. We&apos;ll identify which programs
          you qualify for — no account needed.
        </p>

        {/* Choice cards */}
        <div className="flex flex-col sm:flex-row gap-4 w-full" style={{ maxWidth: 440 }}>
          {/* Voice */}
          <Link
            href="/onboarding/voice"
            className="flex-1 flex flex-col items-start gap-5 p-6 rounded-2xl transition-all"
            style={{
              backgroundColor: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.12)",
              textDecoration: "none",
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLElement;
              el.style.backgroundColor = "rgba(255,255,255,0.11)";
              el.style.borderColor = "rgba(255,255,255,0.24)";
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLElement;
              el.style.backgroundColor = "rgba(255,255,255,0.06)";
              el.style.borderColor = "rgba(255,255,255,0.12)";
            }}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: "rgba(255,255,255,0.1)" }}
            >
              <Mic size={18} color="rgba(255,255,255,0.85)" />
            </div>
            <div>
              <p style={{ fontWeight: 500, fontSize: 15, color: "#ffffff", marginBottom: 4 }}>
                Talk to our AI
              </p>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", lineHeight: 1.5 }}>
                Voice conversation<br />Around 3 minutes
              </p>
            </div>
          </Link>

          {/* Form */}
          <Link
            href="/onboarding/form"
            className="flex-1 flex flex-col items-start gap-5 p-6 rounded-2xl transition-all"
            style={{
              backgroundColor: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.12)",
              textDecoration: "none",
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLElement;
              el.style.backgroundColor = "rgba(255,255,255,0.11)";
              el.style.borderColor = "rgba(255,255,255,0.24)";
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLElement;
              el.style.backgroundColor = "rgba(255,255,255,0.06)";
              el.style.borderColor = "rgba(255,255,255,0.12)";
            }}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: "rgba(255,255,255,0.1)" }}
            >
              <FileText size={18} color="rgba(255,255,255,0.85)" />
            </div>
            <div>
              <p style={{ fontWeight: 500, fontSize: 15, color: "#ffffff", marginBottom: 4 }}>
                Fill out a form
              </p>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", lineHeight: 1.5 }}>
                Step-by-step questions<br />Around 5 minutes
              </p>
            </div>
          </Link>
        </div>

        {/* Footer links */}
        <div className="mt-10 text-center space-y-3">
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.35)" }}>
            Already have an account?{" "}
            <Link
              href="/auth/login"
              style={{ color: "rgba(255,255,255,0.6)", textDecoration: "underline", textUnderlineOffset: 3 }}
            >
              Sign in
            </Link>
          </p>
          <p
            style={{
              fontSize: 11,
              color: "rgba(255,255,255,0.22)",
              lineHeight: 1.6,
              maxWidth: "38ch",
              margin: "0 auto",
            }}
          >
            General information only — not legal advice.
            Results are saved for 7 days without an account.
          </p>
        </div>
      </main>
    </div>
  );
}
