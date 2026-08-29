"use client";

import Link from "next/link";
import { useGuestSession } from "@/lib/guest-session";
import { GuestVoiceTab } from "./GuestVoiceTab";
import { VoiceProfilePanel } from "@/components/voice/VoiceProfilePanel";
import { useState, useCallback } from "react";
import type { VoiceExtractedProfile } from "@/modules/voice/types";

/** Full-screen voice onboarding shell for unauthenticated guests. */
export function GuestVoiceOnboarding() {
  const { token, loading, error: sessionError } = useGuestSession();
  const [profile, setProfile] = useState<Partial<VoiceExtractedProfile>>({});

  const handleProfileUpdate = useCallback((delta: Partial<VoiceExtractedProfile>) => {
    setProfile((prev) => ({ ...prev, ...delta }));
  }, []);

  return (
    <div
      className="flex flex-col h-screen overflow-hidden"
      style={{
        background: "#FAFAF8",
        "--voice-bg": "#FAFAF8",
        "--voice-surface": "#FFFFFF",
        "--voice-border": "rgba(0,0,0,0.07)",
        "--voice-text": "#1A1A2E",
        "--voice-text-muted": "#8B8BA0",
        "--voice-violet": "#534AB7",
        "--voice-violet-soft": "rgba(83,74,183,0.08)",
        "--voice-violet-glow": "rgba(83,74,183,0.18)",
      } as React.CSSProperties}
    >
      {/* Header */}
      <header
        className="shrink-0 flex items-center justify-between px-8 h-14"
        style={{ borderBottom: "1px solid var(--voice-border)" }}
      >
        <span
          className="font-bold tracking-tight"
          style={{ color: "var(--voice-text)", fontFamily: "Urbanist, sans-serif" }}
        >
          Pathways
        </span>
        <div className="flex items-center gap-4">
          <Link
            href="/onboarding"
            style={{
              fontSize: 11,
              color: "var(--voice-text-muted)",
              fontFamily: "Urbanist, sans-serif",
              textDecoration: "underline",
              textUnderlineOffset: 2,
            }}
          >
            ← Back
          </Link>
          <Link
            href="/onboarding/form"
            style={{
              fontSize: 11,
              color: "var(--voice-text-muted)",
              fontFamily: "Urbanist, sans-serif",
              textDecoration: "underline",
              textUnderlineOffset: 2,
            }}
          >
            Switch to form →
          </Link>
        </div>
      </header>

      {/* Main */}
      <div className="flex-1 flex items-center justify-center overflow-auto px-8 py-8">
        {loading && (
          <p style={{ fontSize: 14, color: "var(--voice-text-muted)", fontFamily: "Urbanist, sans-serif" }}>
            Starting session…
          </p>
        )}
        {!loading && sessionError && (
          <p style={{ fontSize: 14, color: "#dc2626", fontFamily: "Urbanist, sans-serif" }}>
            Could not start session. Please refresh.
          </p>
        )}
        {!loading && !sessionError && token && (
          <div className="flex flex-col md:flex-row gap-12 md:gap-20 items-center w-full max-w-4xl">
            <div className="flex-1 flex justify-center">
              <GuestVoiceTab
                guestToken={token}
                onProfileUpdate={handleProfileUpdate}
                profile={profile}
              />
            </div>
            <div className="w-full md:w-80 flex-shrink-0">
              <VoiceProfilePanel profile={profile} />
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 flex justify-center pb-4 px-8">
        <p
          className="text-center"
          style={{ fontSize: 11, color: "var(--voice-text-muted)", fontFamily: "Urbanist, sans-serif", maxWidth: 480 }}
        >
          This tool provides general information only and does not constitute legal advice.
        </p>
      </div>
    </div>
  );
}
