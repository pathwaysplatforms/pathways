"use client";

import type { VoiceExtractedProfile } from "@/modules/voice/types";

interface ProfileTrackerProps {
  profile: Partial<VoiceExtractedProfile>;
  currentField?: string;
}

interface FieldDef {
  key: Extract<keyof Omit<VoiceExtractedProfile, "requires_review">, string>;
  label: string;
}

const FIELDS: FieldDef[] = [
  { key: "full_name", label: "Full name" },
  { key: "date_of_birth", label: "Date of birth" },
  { key: "nationality", label: "Nationality" },
  { key: "current_country", label: "Current country" },
  { key: "marital_status", label: "Marital status" },
  { key: "spouse_coming_to_canada", label: "Spouse to Canada" },
  { key: "education_level_voice", label: "Education level" },
  { key: "years_experience", label: "Years of experience" },
  { key: "has_canadian_experience", label: "Canadian experience" },
  { key: "occupation", label: "Occupation" },
  { key: "language_proficiency_self", label: "Language proficiency" },
  { key: "has_family_in_canada", label: "Family in Canada" },
  { key: "intended_province", label: "Preferred province" },
  { key: "annual_income", label: "Annual income" },
  { key: "income_currency", label: "Income currency" },
];

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function isCollected(value: unknown): boolean {
  return value !== null && value !== undefined && value !== "";
}

/** Right-panel field tracker that shows collection status for all 15 profile fields. */
export function ProfileTracker({ profile, currentField }: ProfileTrackerProps) {
  const collected = FIELDS.filter((f) => isCollected(profile[f.key])).length;
  const total = FIELDS.length;
  const pct = Math.round((collected / total) * 100);

  return (
    <div className="flex flex-col h-full">
      <p className="label-eyebrow mb-4">Your profile</p>

      <div className="flex-1 overflow-y-auto space-y-0.5 min-h-0">
        {FIELDS.map((field) => {
          const value = profile[field.key];
          const collected = isCollected(value);
          const isActive = currentField === field.key;

          return (
            <div
              key={field.key}
              className={[
                "flex items-start gap-2.5 px-3 py-2 rounded-input transition-colors",
                isActive ? "bg-accent-50" : collected ? "bg-transparent" : "bg-transparent",
              ].join(" ")}
            >
              <div className="shrink-0 mt-0.5">
                {collected ? (
                  <div className="w-4 h-4 rounded-full bg-accent-500 flex items-center justify-center">
                    <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 8" fill="none">
                      <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                ) : isActive ? (
                  <div className="w-4 h-4 rounded-full border-2 border-accent-400 flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-accent-400 animate-pulse" />
                  </div>
                ) : (
                  <div className="w-4 h-4 rounded-full border-2 border-border" />
                )}
              </div>

              <div className="min-w-0">
                <p className="text-xs font-medium text-text-tertiary uppercase tracking-wide leading-none mb-0.5">
                  {field.label}
                </p>
                {collected ? (
                  <p className="text-sm text-text-primary leading-snug truncate">
                    {formatValue(value)}
                  </p>
                ) : isActive ? (
                  <p className="text-xs text-accent-600 leading-snug">collecting…</p>
                ) : (
                  <p className="text-xs text-text-disabled leading-snug">—</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Progress bar */}
      <div className="mt-4 pt-4 border-t border-border-light shrink-0">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-text-tertiary">
            {collected} of {total} fields
          </span>
          <span className="text-xs font-medium text-text-secondary">{pct}%</span>
        </div>
        <div className="h-1.5 bg-bg-subtle rounded-pill overflow-hidden">
          <div
            className="h-full bg-accent-500 rounded-pill transition-all duration-500 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
