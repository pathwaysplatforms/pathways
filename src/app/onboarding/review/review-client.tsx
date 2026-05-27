"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { VoiceExtractedProfile } from "@/modules/voice/types";
import type { CrsEstimate } from "@/lib/pathway-input";

interface ReviewClientProps {
  profileId: string;
  extracted: Partial<VoiceExtractedProfile>;
  voiceSessionId: string | null;
  crsEstimate: CrsEstimate;
}

type ProfileFieldKey = Extract<keyof Omit<VoiceExtractedProfile, "requires_review">, string>;

interface FieldConfig {
  key: ProfileFieldKey;
  label: string;
  type: "text" | "number" | "date" | "select" | "boolean";
  options?: { value: string; label: string }[];
}

const FIELDS: FieldConfig[] = [
  { key: "full_name", label: "Full name", type: "text" },
  { key: "date_of_birth", label: "Date of birth", type: "date" },
  { key: "nationality", label: "Nationality", type: "text" },
  { key: "current_country", label: "Country of residence", type: "text" },
  {
    key: "marital_status", label: "Marital status", type: "select",
    options: [
      { value: "", label: "Not specified" },
      { value: "single", label: "Single" },
      { value: "married", label: "Married" },
      { value: "common-law", label: "Common-law" },
      { value: "separated", label: "Separated" },
      { value: "divorced", label: "Divorced" },
      { value: "widowed", label: "Widowed" },
    ],
  },
  {
    key: "spouse_coming_to_canada", label: "Spouse coming to Canada", type: "boolean",
    options: [
      { value: "", label: "Not specified" },
      { value: "true", label: "Yes" },
      { value: "false", label: "No" },
    ],
  },
  { key: "education_level_voice", label: "Education level", type: "text" },
  { key: "years_experience", label: "Years of experience", type: "number" },
  {
    key: "has_canadian_experience", label: "Canadian work experience", type: "boolean",
    options: [
      { value: "", label: "Not specified" },
      { value: "true", label: "Yes" },
      { value: "false", label: "No" },
    ],
  },
  { key: "occupation", label: "Occupation", type: "text" },
  {
    key: "language_proficiency_self", label: "Language proficiency", type: "select",
    options: [
      { value: "", label: "Not specified" },
      { value: "native", label: "Native speaker" },
      { value: "fluent", label: "Fluent" },
      { value: "advanced", label: "Advanced" },
      { value: "intermediate", label: "Intermediate" },
      { value: "basic", label: "Basic" },
    ],
  },
  {
    key: "has_family_in_canada", label: "Family in Canada", type: "boolean",
    options: [
      { value: "", label: "Not specified" },
      { value: "true", label: "Yes" },
      { value: "false", label: "No" },
    ],
  },
  { key: "intended_province", label: "Preferred province", type: "text" },
  { key: "annual_income", label: "Annual income", type: "number" },
  { key: "income_currency", label: "Income currency", type: "text" },
];

// Recent Express Entry draw cutoffs (illustrative — update from IRCC data)
const RECENT_CUTOFFS = [524, 510, 505, 491, 488];

function fieldValueToString(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

function CrsBar({ low, high }: { low: number; high: number }) {
  const scale = { min: 400, max: 600 };
  const toPercent = (v: number) =>
    Math.max(0, Math.min(100, ((v - scale.min) / (scale.max - scale.min)) * 100));

  return (
    <div className="relative h-6 bg-bg-subtle rounded-pill overflow-visible mt-4">
      {/* User range */}
      <div
        className="absolute top-0 h-full bg-accent-200 rounded-pill"
        style={{
          left: `${toPercent(low)}%`,
          width: `${toPercent(high) - toPercent(low)}%`,
        }}
      />
      <div
        className="absolute top-0 h-full bg-accent-500 rounded-pill opacity-80"
        style={{
          left: `${toPercent(Math.round((low + high) / 2)) - 0.5}%`,
          width: "1%",
        }}
      />
      {/* Cutoff marks */}
      {RECENT_CUTOFFS.map((cutoff) => (
        <div
          key={cutoff}
          className="absolute top-0 h-full w-px bg-text-tertiary opacity-40"
          style={{ left: `${toPercent(cutoff)}%` }}
          title={`Draw: ${cutoff}`}
        />
      ))}
      {/* Scale labels */}
      <div className="absolute -bottom-5 left-0 text-xs text-text-tertiary">{scale.min}</div>
      <div className="absolute -bottom-5 right-0 text-xs text-text-tertiary">{scale.max}</div>
    </div>
  );
}

/** Editable review form with inline editing, CRS estimate card, and confirm/restart CTAs. */
export function ReviewClient({ profileId, extracted, voiceSessionId, crsEstimate }: ReviewClientProps) {
  const router = useRouter();
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const f of FIELDS) init[f.key] = fieldValueToString(extracted[f.key]);
    return init;
  });
  const [pendingSave, setPendingSave] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requiresReview = extracted.requires_review ?? [];

  const saveField = useCallback(async (key: string, value: string) => {
    setPendingSave(key);
    try {
      await fetch("/api/onboarding/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value === "" ? null : value }),
      });
    } catch { /* silently fail — best-effort save */ }
    setPendingSave(null);
    setEditingKey(null);
  }, []);

  const handleConfirm = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voiceSessionId, method: "voice" }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: { message?: string } };
        throw new Error(data.error?.message ?? "Confirmation failed");
      }
      router.push("/onboarding/matches");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setSubmitting(false);
    }
  };

  const handleRestart = async () => {
    setRestarting(true);
    try {
      await fetch("/api/onboarding/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ onboarding_step: "not_started" }),
      });
    } catch { /* best-effort */ }
    router.push("/onboarding/voice");
  };

  const midpoint = Math.round((crsEstimate.low + crsEstimate.high) / 2);

  return (
    <div className="space-y-6">
      {/* ── CRS Estimate card ──────────────────────────────────────────── */}
      <div className="card p-gutter">
        <p className="label-eyebrow mb-1">Estimated CRS range</p>
        <div className="flex items-baseline gap-3 mb-1">
          <span className="text-4xl font-extrabold text-text-primary">~{midpoint}</span>
          <span className="text-lg text-text-secondary font-medium">points</span>
        </div>
        <p className="text-sm text-text-tertiary mb-1">
          Range: {crsEstimate.low} – {crsEstimate.high}
        </p>
        <CrsBar low={crsEstimate.low} high={crsEstimate.high} />
        <div className="mt-8">
          <p className="text-xs text-text-tertiary leading-relaxed">
            Estimate only — complete your full profile on the dashboard for an exact score.{" "}
            <a href="/dashboard" className="text-accent-600 hover:underline">
              Get your exact score on the dashboard →
            </a>
          </p>
        </div>
      </div>

      {/* ── Profile fields ─────────────────────────────────────────────── */}
      <div className="card p-gutter">
        <p className="label-eyebrow mb-4">Your profile</p>
        <div className="grid sm:grid-cols-2 gap-4">
          {FIELDS.map((field) => {
            const needsReview = requiresReview.includes(field.key);
            const isEditing = editingKey === field.key;
            const isSaving = pendingSave === field.key;
            const displayValue = values[field.key];
            const hasValue = displayValue !== "" && displayValue !== null && displayValue !== undefined;

            return (
              <div
                key={field.key}
                className={[
                  "rounded-input p-3 border transition-colors",
                  needsReview
                    ? "border-yellow-300 bg-yellow-50"
                    : "border-border-light bg-bg-base",
                ].join(" ")}
              >
                <p className={[
                  "text-xs font-medium uppercase tracking-wide mb-1",
                  needsReview ? "text-yellow-700" : "text-text-tertiary",
                ].join(" ")}>
                  {field.label}
                  {needsReview && <span className="ml-1 normal-case font-normal tracking-normal text-yellow-600">— needs review</span>}
                </p>

                {isEditing ? (
                  <div className="flex gap-2 items-center">
                    {field.type === "select" || field.type === "boolean" ? (
                      <select
                        autoFocus
                        value={values[field.key]}
                        onChange={(e) => setValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                        onBlur={() => void saveField(field.key, values[field.key])}
                        className="flex-1 h-8 border border-accent-500 rounded text-sm px-2 focus:outline-none bg-bg-surface"
                      >
                        {field.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    ) : (
                      <input
                        autoFocus
                        type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
                        value={values[field.key]}
                        onChange={(e) => setValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                        onBlur={() => void saveField(field.key, values[field.key])}
                        onKeyDown={(e) => e.key === "Enter" && void saveField(field.key, values[field.key])}
                        className="flex-1 h-8 border border-accent-500 rounded text-sm px-2 focus:outline-none bg-bg-surface"
                      />
                    )}
                    {isSaving && <span className="text-xs text-text-tertiary">saving…</span>}
                  </div>
                ) : (
                  <button
                    onClick={() => setEditingKey(field.key)}
                    className="w-full text-left"
                  >
                    <span className={[
                      "text-sm block truncate",
                      hasValue ? "text-text-primary" : "text-text-disabled italic",
                    ].join(" ")}>
                      {hasValue ? displayValue : "Not collected — click to edit"}
                    </span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Actions ────────────────────────────────────────────────────── */}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        onClick={() => void handleConfirm()}
        disabled={submitting}
        className="btn-primary w-full py-3 disabled:opacity-50"
      >
        {submitting ? "Saving…" : "This looks right — show me my options"}
      </button>

      <button
        onClick={() => void handleRestart()}
        disabled={restarting}
        className="btn-secondary w-full py-3 disabled:opacity-50"
      >
        {restarting ? "Resetting…" : "Start the conversation again"}
      </button>
    </div>
  );
}
