"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { EDUCATION_OPTIONS, NOC_TEER_OPTIONS } from "@/modules/voice/types";
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

const YES_NO_OPTIONS = [
  { value: "", label: "Not specified" },
  { value: "true", label: "Yes" },
  { value: "false", label: "No" },
];

// Fields ordered by how directly they drive pathway elimination/scoring
// (see matcher-engine.ts PATHWAY_RULES and crs-estimate.ts) — the highest-stakes
// extraction fields are surfaced first so users are most likely to check them.
const FIELDS: FieldConfig[] = [
  // ── Matching-critical: occupation / language / education ──────────────────
  { key: "occupation", label: "Occupation", type: "text" },
  {
    key: "noc_teer_category", label: "Occupation skill level (TEER)", type: "select",
    options: NOC_TEER_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
  },
  { key: "noc_code", label: "NOC code (if known)", type: "text" },
  { key: "clb_speaking", label: "CLB — Speaking", type: "number" },
  { key: "clb_listening", label: "CLB — Listening", type: "number" },
  { key: "clb_reading", label: "CLB — Reading", type: "number" },
  { key: "clb_writing", label: "CLB — Writing", type: "number" },
  {
    key: "education_level", label: "Highest education (structured)", type: "select",
    options: EDUCATION_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
  },
  { key: "education_level_voice", label: "Education — as described", type: "text" },
  {
    key: "eca_obtained", label: "Foreign credential assessed (ECA)", type: "boolean",
    options: YES_NO_OPTIONS,
  },

  // ── Matching-critical: work experience ─────────────────────────────────────
  { key: "years_experience", label: "Total years of experience", type: "number" },
  { key: "canadian_work_years", label: "Years worked in Canada", type: "number" },
  { key: "foreign_work_years", label: "Years worked outside Canada", type: "number" },

  // ── Matching-critical: hard-eligibility gates ───────────────────────────────
  {
    key: "has_family_in_canada", label: "Family in Canada", type: "boolean",
    options: YES_NO_OPTIONS,
  },
  {
    key: "has_canadian_job_offer", label: "Canadian job offer", type: "boolean",
    options: YES_NO_OPTIONS,
  },
  {
    key: "has_provincial_nomination", label: "Provincial nomination", type: "boolean",
    options: YES_NO_OPTIONS,
  },
  {
    key: "has_prior_canadian_study", label: "Studied full-time in Canada", type: "boolean",
    options: YES_NO_OPTIONS,
  },
  { key: "intended_province", label: "Preferred province", type: "text" },

  // ── Identity / context (low matching weight, kept for the record) ─────────
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
    options: YES_NO_OPTIONS,
  },
  {
    key: "language_proficiency_self", label: "Self-rated language proficiency", type: "select",
    options: [
      { value: "", label: "Not specified" },
      { value: "native", label: "Native speaker" },
      { value: "fluent", label: "Fluent" },
      { value: "advanced", label: "Advanced" },
      { value: "intermediate", label: "Intermediate" },
      { value: "basic", label: "Basic" },
    ],
  },
];

// Rendered as a "select" (for human-readable labels) but the API expects a number.
const NUMERIC_SELECT_KEYS = new Set<ProfileFieldKey>(["noc_teer_category"]);

/** Coerce a raw string input to the type the API schema expects (number/boolean/string). */
function coerceFieldValue(key: string, value: string): string | number | boolean | null {
  if (value === "") return null;
  const fieldType = FIELDS.find((f) => f.key === key)?.type;
  if (fieldType === "number" || NUMERIC_SELECT_KEYS.has(key as ProfileFieldKey)) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  if (fieldType === "boolean") {
    if (value === "true") return true;
    if (value === "false") return false;
    return null;
  }
  return value;
}

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
  const [matchingPhase, setMatchingPhase] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requiresReview = extracted.requires_review ?? [];

  const saveField = useCallback(async (key: string, value: string) => {
    setPendingSave(key);
    try {
      const res = await fetch("/api/onboarding/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: coerceFieldValue(key, value) }),
      });
      if (!res.ok) {
        setError("Could not save that change. Please try again.");
      }
    } catch { /* network failure — best-effort save */ }
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
      setMatchingPhase(true);
      await fetch("/api/pathways/match", { method: "POST" }).catch(() => undefined);
      router.push("/onboarding/matches");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setSubmitting(false);
      setMatchingPhase(false);
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
        {submitting
          ? matchingPhase
            ? "Finding your matches…"
            : "Saving your profile…"
          : "This looks right — show me my options"}
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
