"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { VoiceExtractedProfile } from "@/modules/voice/types";

interface ReviewClientProps {
  extracted: Partial<VoiceExtractedProfile>;
}

interface FieldConfig {
  key: keyof Omit<VoiceExtractedProfile, "requires_review">;
  label: string;
  type: "text" | "number" | "select" | "boolean";
  options?: { value: string; label: string }[];
}

const FIELDS: FieldConfig[] = [
  { key: "full_name", label: "Full name", type: "text" },
  { key: "nationality", label: "Nationality", type: "text" },
  { key: "current_country", label: "Country of residence", type: "text" },
  { key: "occupation", label: "Occupation", type: "text" },
  { key: "years_experience", label: "Years of experience", type: "number" },
  {
    key: "has_degree",
    label: "Holds a university degree",
    type: "select",
    options: [
      { value: "", label: "Not specified" },
      { value: "true", label: "Yes" },
      { value: "false", label: "No" },
    ],
  },
  {
    key: "degree_level",
    label: "Degree level",
    type: "select",
    options: [
      { value: "", label: "Not specified" },
      { value: "bachelor", label: "Bachelor" },
      { value: "master", label: "Master" },
      { value: "phd", label: "PhD" },
      { value: "other", label: "Other" },
    ],
  },
  { key: "degree_field", label: "Degree field", type: "text" },
  { key: "annual_salary_gbp", label: "Annual salary (GBP)", type: "number" },
  {
    key: "has_criminal_record",
    label: "Has criminal convictions",
    type: "select",
    options: [
      { value: "", label: "Not specified" },
      { value: "true", label: "Yes" },
      { value: "false", label: "No" },
    ],
  },
  {
    key: "english_level",
    label: "English level",
    type: "select",
    options: [
      { value: "", label: "Not specified" },
      { value: "native", label: "Native" },
      { value: "fluent", label: "Fluent" },
      { value: "b2", label: "B2" },
      { value: "b1", label: "B1" },
      { value: "below_b1", label: "Below B1" },
    ],
  },
  {
    key: "marital_status",
    label: "Marital status",
    type: "select",
    options: [
      { value: "", label: "Not specified" },
      { value: "single", label: "Single" },
      { value: "married", label: "Married" },
      { value: "divorced", label: "Divorced" },
      { value: "widowed", label: "Widowed" },
      { value: "common-law", label: "Common-law" },
    ],
  },
  {
    key: "has_dependents",
    label: "Has dependents",
    type: "select",
    options: [
      { value: "", label: "Not specified" },
      { value: "true", label: "Yes" },
      { value: "false", label: "No" },
    ],
  },
];

function fieldValueToString(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

/** Editable review form for the voice-extracted profile. */
export function ReviewClient({ extracted }: ReviewClientProps) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const f of FIELDS) {
      init[f.key] = fieldValueToString(extracted[f.key]);
    }
    return init;
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requiresReview = extracted.requires_review ?? [];

  const handleChange = (key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleConfirm = async () => {
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/voice/confirm", { method: "POST" });
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

  return (
    <div className="space-y-4">
      <div className="bg-white border border-neutral-200 rounded-xl p-5 space-y-5">
        {FIELDS.map((field) => {
          const needsReview = requiresReview.includes(field.key);
          const inputClass = [
            "h-10 border rounded-md px-3 text-sm w-full focus:outline-none focus:ring-2",
            needsReview
              ? "border-yellow-400 focus:ring-yellow-400"
              : "border-neutral-200 focus:ring-blue-600 focus:border-blue-600",
          ].join(" ");

          return (
            <div key={field.key}>
              <label
                htmlFor={field.key}
                className="block text-xs font-medium uppercase tracking-wide text-neutral-400 mb-1"
              >
                {field.label}
                {needsReview && (
                  <span className="ml-2 text-yellow-600 normal-case tracking-normal font-normal">
                    — needs review
                  </span>
                )}
              </label>
              {field.type === "select" ? (
                <select
                  id={field.key}
                  value={values[field.key]}
                  onChange={(e) => handleChange(field.key, e.target.value)}
                  className={inputClass}
                >
                  {field.options?.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id={field.key}
                  type={field.type === "number" ? "number" : "text"}
                  value={values[field.key]}
                  onChange={(e) => handleChange(field.key, e.target.value)}
                  className={inputClass}
                />
              )}
            </div>
          );
        })}
      </div>

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      <button
        onClick={handleConfirm}
        disabled={submitting}
        className="w-full h-10 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {submitting ? "Saving…" : "Confirm my details"}
      </button>
    </div>
  );
}
