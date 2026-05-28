"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Mic, MessageSquare, FileText } from "lucide-react";
import type { VoiceExtractedProfile } from "@/modules/voice/types";
import { VoiceTab } from "./VoiceTab";
import { ChatTab } from "./ChatTab";
import { FormTab } from "./FormTab";
import { ProfileTracker } from "./ProfileTracker";

type Tab = "voice" | "chat" | "form";

type TabIcon = typeof Mic;
const TABS: { id: Tab; label: string; icon: TabIcon }[] = [
  { id: "voice", label: "Voice", icon: Mic },
  { id: "chat", label: "Chat", icon: MessageSquare },
  { id: "form", label: "Form", icon: FileText },
];

const NUMERIC_FIELDS = new Set(["years_experience", "annual_income"]);
const BOOLEAN_FIELDS = new Set(["spouse_coming_to_canada", "has_canadian_experience", "has_family_in_canada"]);

/** Split-panel onboarding interface with voice, chat, and form collection modes. */
export function OnboardingLayout() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("voice");
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

  return (
    <div className="flex flex-col h-screen bg-bg-base overflow-hidden">
      {/* ── Narrow top bar ──────────────────────────────────────────────── */}
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

      {/* ── Main content ────────────────────────────────────────────────── */}
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
              {activeTab === "voice" && "Speak naturally — our AI will guide the conversation"}
              {activeTab === "chat" && "Prefer to type? Chat with our AI assistant"}
              {activeTab === "form" && "Fill out the form at your own pace"}
            </p>
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-hidden p-gutter">
            {activeTab === "voice" && (
              <VoiceTab
                key={resetKey}
                onProfileUpdate={handleProfileUpdate}
                onSwitchToChat={handleSwitchToChat}
              />
            )}
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
          <ProfileTracker
            profile={profile}
            onFieldEdit={handleFieldEdit}
          />
        </div>
      </div>
    </div>
  );
}
