"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mic, MessageSquare, FileText } from "lucide-react";
import type { VoiceExtractedProfile } from "@/modules/voice/types";
import { VoiceTab } from "./VoiceTab";
import { ChatTab } from "./ChatTab";
import { FormTab } from "./FormTab";
import { ProfileTracker } from "./ProfileTracker";
import { VoiceProfilePanel } from "@/components/voice/VoiceProfilePanel";
import { resolveDisplayFields } from "@/lib/profile-field-display";

type Tab = "voice" | "chat" | "form";

type TabIcon = typeof Mic;
const TABS: { id: Tab; label: string; icon: TabIcon }[] = [
  { id: "voice", label: "Voice", icon: Mic },
  { id: "chat", label: "Chat", icon: MessageSquare },
  { id: "form", label: "Form", icon: FileText },
];

const NUMERIC_FIELDS = new Set(["years_experience", "annual_income", "dependents"]);
const BOOLEAN_FIELDS = new Set(["spouse_coming_to_canada", "has_canadian_experience", "has_family_in_canada"]);

const TOTAL_DISPLAYABLE = 21;

/** Split-panel onboarding interface with voice, chat, and form collection modes. */
export function OnboardingLayout({ initialTab = "voice" }: { initialTab?: Tab }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [profile, setProfile] = useState<Partial<VoiceExtractedProfile>>({});
  const [resetKey, setResetKey] = useState(0);

  const handleProfileUpdate = useCallback((delta: Partial<VoiceExtractedProfile>) => {
    setProfile((prev: Partial<VoiceExtractedProfile>) => ({ ...prev, ...delta }));
  }, []);

  const handleSwitchToChat = useCallback(() => {
    setActiveTab("chat");
  }, []);

  const handleFieldEdit = useCallback((field: string, rawValue: string) => {
    const trimmed = rawValue.trim();
    let coercedValue: string | number | boolean | null;
    if (!trimmed) {
      coercedValue = null;
    } else if (NUMERIC_FIELDS.has(field)) {
      const n = parseInt(trimmed, 10);
      coercedValue = isNaN(n) ? null : n;
    } else if (BOOLEAN_FIELDS.has(field)) {
      coercedValue = trimmed.toLowerCase() === "true" || trimmed.toLowerCase() === "yes";
    } else {
      coercedValue = trimmed;
    }

    setProfile((prev) => ({ ...prev, [field]: coercedValue } as Partial<VoiceExtractedProfile>));

    void fetch("/api/onboarding/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: coercedValue }),
    });
  }, []);

  const handleStartAgain = useCallback(async () => {
    if (!window.confirm("This will clear all your answers. Are you sure?")) return;
    await fetch("/api/onboarding/reset", { method: "POST" });
    setProfile({});
    setActiveTab("voice");
    setResetKey((k) => k + 1);
    router.replace("/onboarding/voice");
  }, [router]);

  // Count resolved fields for the mini progress bar in VoiceTab
  const requiredCollected = useMemo(() => resolveDisplayFields(profile).length, [profile]);

  // ── Voice mode: full-screen focused layout ─────────────────────────
  if (activeTab === "voice") {
    return (
      <div
        className="flex flex-col h-screen overflow-hidden"
        style={
          {
            background: "var(--voice-bg, #FAFAF8)",
            "--voice-bg": "#FAFAF8",
            "--voice-surface": "#FFFFFF",
            "--voice-border": "rgba(0,0,0,0.07)",
            "--voice-text": "#1A1A2E",
            "--voice-text-muted": "#8B8BA0",
            "--voice-violet": "#534AB7",
            "--voice-violet-soft": "rgba(83,74,183,0.08)",
            "--voice-violet-glow": "rgba(83,74,183,0.18)",
          } as React.CSSProperties
        }
      >
        {/* Header */}
        <header
          className="shrink-0 flex items-center justify-between px-8 h-14"
          style={{ borderBottom: "1px solid var(--voice-border, rgba(0,0,0,0.07))" }}
        >
          <span
            className="font-bold tracking-tight"
            style={{ color: "var(--voice-text, #1A1A2E)", fontFamily: "Urbanist, sans-serif" }}
          >
            Pathways
          </span>
          <div className="flex items-center gap-4">
            <button
              onClick={() => void handleStartAgain()}
              style={{
                fontSize: 11,
                color: "var(--voice-text-muted, #8B8BA0)",
                fontFamily: "Urbanist, sans-serif",
                textDecoration: "underline",
                textUnderlineOffset: 2,
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 0,
              }}
            >
              Start again
            </button>
            <span
              className="text-xs border rounded px-2.5 py-1 cursor-pointer"
              style={{
                color: "var(--voice-text-muted, #8B8BA0)",
                borderColor: "var(--voice-border, rgba(0,0,0,0.07))",
                fontFamily: "Urbanist, sans-serif",
              }}
            >
              EN / FR
            </span>
          </div>
        </header>

        {/* Main — two-column on desktop, stacked on mobile */}
        <div className="flex-1 flex items-center justify-center overflow-auto px-8 py-8">
          <div className="flex flex-col md:flex-row gap-12 md:gap-20 items-center w-full max-w-4xl">
            {/* Left: orb column */}
            <div className="flex-1 flex justify-center">
              <VoiceTab
                key={resetKey}
                onProfileUpdate={handleProfileUpdate}
                onSwitchToChat={handleSwitchToChat}
                requiredCollected={requiredCollected}
                totalRequired={TOTAL_DISPLAYABLE}
              />
            </div>

            {/* Right: profile panel */}
            <div className="w-full md:w-80 flex-shrink-0">
              <VoiceProfilePanel profile={profile} />
            </div>
          </div>
        </div>

        {/* Prefer to type? — small CTAs to switch to form or chat */}
        <div className="shrink-0 flex items-center justify-center gap-5 pb-1 px-8">
          <Link
            href="/onboarding/form"
            style={{
              fontSize: 13,
              color: "var(--voice-text-muted, #8B8BA0)",
              fontFamily: "Urbanist, sans-serif",
              textDecoration: "none",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--voice-text, #1A1A2E)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--voice-text-muted, #8B8BA0)"; }}
          >
            Fill out a form →
          </Link>
          <span style={{ color: "var(--voice-text-muted, #8B8BA0)", fontSize: 13, opacity: 0.4 }}>·</span>
          <button
            onClick={() => setActiveTab("chat")}
            style={{
              fontSize: 13,
              color: "var(--voice-text-muted, #8B8BA0)",
              fontFamily: "Urbanist, sans-serif",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--voice-text, #1A1A2E)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--voice-text-muted, #8B8BA0)"; }}
          >
            Chat instead →
          </button>
        </div>

        {/* Footer disclaimer */}
        <div className="shrink-0 flex justify-center pb-4 px-8">
          <p
            className="text-center"
            style={{
              fontSize: 11,
              color: "var(--voice-text-muted, #8B8BA0)",
              fontFamily: "Urbanist, sans-serif",
              maxWidth: 480,
            }}
          >
            This tool provides general information only and does not constitute legal advice.
          </p>
        </div>
      </div>
    );
  }

  // ── Chat / Form mode: split-panel tab layout ───────────────────────
  return (
    <div className="flex flex-col h-screen bg-bg-base overflow-hidden">
      {/* Narrow top bar */}
      <header className="shrink-0 bg-bg-surface border-b border-border-light">
        <div className="flex items-center justify-between h-13 px-gutter-lg">
          <span className="text-text-primary font-bold tracking-tight">Pathways</span>
          <p className="text-xs font-medium text-text-tertiary hidden sm:block">
            Tell us about yourself
          </p>
          <span className="text-xs text-text-tertiary border border-border rounded-btn px-2.5 py-1 cursor-pointer hover:bg-bg-subtle transition-colors">
            EN / FR
          </span>
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel — 65% */}
        <div className="flex flex-col w-full lg:w-[65%] border-r border-border-light bg-bg-surface overflow-hidden">
          {/* Tab bar */}
          <div className="shrink-0 border-b border-border-light px-gutter">
            <div className="flex gap-0">
              {TABS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={[
                    "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors",
                    activeTab === id
                      ? "border-accent-500 text-accent-600"
                      : "border-transparent text-text-tertiary hover:text-text-secondary",
                  ].join(" ")}
                >
                  <Icon size={15} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Tab hint */}
          <div className="shrink-0 px-gutter py-3 border-b border-border-light bg-bg-subtle">
            <p className="text-xs text-text-tertiary">
              {activeTab === "chat" && "Prefer to type? Chat with our AI assistant"}
              {activeTab === "form" && "Fill out the form at your own pace"}
            </p>
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-hidden p-gutter">
            {activeTab === "chat" && (
              <ChatTab onProfileUpdate={handleProfileUpdate} />
            )}
            {activeTab === "form" && (
              <FormTab onProfileUpdate={handleProfileUpdate} />
            )}
          </div>

          {/* Start again */}
          <div className="shrink-0 px-gutter pb-4 flex justify-center">
            <button
              onClick={() => void handleStartAgain()}
              className="text-xs text-text-tertiary hover:text-text-secondary underline underline-offset-2 transition-colors"
            >
              Start again
            </button>
          </div>
        </div>

        {/* Right panel — 35%, hidden on mobile */}
        <div className="hidden lg:flex flex-col w-[35%] bg-bg-base overflow-hidden p-gutter">
          <ProfileTracker profile={profile} onFieldEdit={handleFieldEdit} />
        </div>
      </div>
    </div>
  );
}
