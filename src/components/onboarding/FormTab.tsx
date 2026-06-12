"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { VoiceExtractedProfile } from "@/modules/voice/types";

interface FormTabProps {
  onProfileUpdate: (delta: Partial<VoiceExtractedProfile>) => void;
}

const COMMON_CURRENCIES = [
  "CAD", "USD", "GBP", "EUR", "INR", "AUD", "PHP", "NGN", "PKR",
] as const;

type FormValues = {
  full_name: string;
  date_of_birth: string;
  nationality: string;
  current_country: string;
  marital_status: string;
  spouse_coming_to_canada: string;
  education_level_voice: string;
  years_experience: string;
  has_canadian_experience: string;
  occupation: string;
  language_proficiency_self: string;
  has_family_in_canada: string;
  intended_province: string;
  annual_income: string;
  income_currency: string;
  income_currency_other: string;
};

/** Form tab — structured form for all 15 pathway-determining fields. */
export function FormTab({ onProfileUpdate }: FormTabProps) {
  const router = useRouter();
  const [values, setValues] = useState<FormValues>({
    full_name: "",
    date_of_birth: "",
    nationality: "",
    current_country: "",
    marital_status: "",
    spouse_coming_to_canada: "",
    education_level_voice: "",
    years_experience: "",
    has_canadian_experience: "",
    occupation: "",
    language_proficiency_self: "",
    has_family_in_canada: "",
    intended_province: "",
    annual_income: "",
    income_currency: "CAD",
    income_currency_other: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const showSpouseField = ["married", "common-law", "common_law"].includes(
    values.marital_status.toLowerCase().replace(/ /g, "_")
  );

  const handleChange = useCallback(
    (key: keyof FormValues, value: string) => {
      setValues((prev) => {
        const next = { ...prev, [key]: value };
        const delta = buildDelta(next);
        if (Object.keys(delta).length > 0) onProfileUpdate(delta);
        return next;
      });
    },
    [onProfileUpdate]
  );

  function buildDelta(vals: FormValues): Partial<VoiceExtractedProfile> {
    const d: Partial<VoiceExtractedProfile> = {};
    if (vals.full_name) d.full_name = vals.full_name;
    if (vals.date_of_birth) d.date_of_birth = vals.date_of_birth;
    if (vals.nationality) d.nationality = vals.nationality;
    if (vals.current_country) d.current_country = vals.current_country;
    if (vals.marital_status) d.marital_status = vals.marital_status;
    if (vals.spouse_coming_to_canada) d.spouse_coming_to_canada = vals.spouse_coming_to_canada === "yes";
    if (vals.education_level_voice) d.education_level_voice = vals.education_level_voice;
    if (vals.years_experience) { const n = parseInt(vals.years_experience, 10); if (!isNaN(n)) d.years_experience = n; }
    if (vals.has_canadian_experience) d.has_canadian_experience = vals.has_canadian_experience === "yes";
    if (vals.occupation) d.occupation = vals.occupation;
    if (vals.language_proficiency_self) d.language_proficiency_self = vals.language_proficiency_self as VoiceExtractedProfile["language_proficiency_self"];
    if (vals.has_family_in_canada) d.has_family_in_canada = vals.has_family_in_canada === "yes";
    if (vals.intended_province) d.intended_province = vals.intended_province === "no_preference" ? null : vals.intended_province;
    if (vals.annual_income) { const n = parseInt(vals.annual_income, 10); if (!isNaN(n)) d.annual_income = n; }
    const currency = vals.income_currency === "Other" ? vals.income_currency_other : vals.income_currency;
    if (currency) d.income_currency = currency;
    return d;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const delta = buildDelta(values);
    try {
      const res = await fetch("/api/onboarding/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(delta),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: { message?: string } };
        throw new Error(data.error?.message ?? "Save failed");
      }
      router.push("/onboarding/review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setSubmitting(false);
    }
  };

  const inputClass = "w-full h-10 border border-border rounded-input px-3 text-sm text-text-primary placeholder:text-text-disabled focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500 bg-bg-surface transition-colors";
  const selectClass = `${inputClass} cursor-pointer`;
  const labelClass = "block text-xs font-medium uppercase tracking-wide text-text-tertiary mb-1.5";

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="h-full overflow-y-auto">
      <div className="space-y-4 pb-4">
        {/* Full name */}
        <div>
          <label className={labelClass}>Full name</label>
          <input type="text" className={inputClass} placeholder="e.g. Priya Sharma" value={values.full_name} onChange={(e) => handleChange("full_name", e.target.value)} />
        </div>

        {/* Date of birth */}
        <div>
          <label className={labelClass}>Date of birth</label>
          <input type="date" className={inputClass} value={values.date_of_birth} onChange={(e) => handleChange("date_of_birth", e.target.value)} />
        </div>

        {/* Nationality */}
        <div>
          <label className={labelClass}>Nationality</label>
          <input type="text" className={inputClass} placeholder="e.g. Indian, Brazilian" value={values.nationality} onChange={(e) => handleChange("nationality", e.target.value)} />
        </div>

        {/* Current country */}
        <div>
          <label className={labelClass}>Current country of residence</label>
          <input type="text" className={inputClass} placeholder="e.g. United Kingdom" value={values.current_country} onChange={(e) => handleChange("current_country", e.target.value)} />
        </div>

        {/* Marital status */}
        <div>
          <label className={labelClass}>Marital status</label>
          <select className={selectClass} value={values.marital_status} onChange={(e) => handleChange("marital_status", e.target.value)}>
            <option value="">Not specified</option>
            <option value="single">Single</option>
            <option value="married">Married</option>
            <option value="common-law">Common-law</option>
            <option value="separated">Separated</option>
            <option value="divorced">Divorced</option>
            <option value="widowed">Widowed</option>
          </select>
        </div>

        {/* Spouse accompanying — only if married/common-law */}
        {showSpouseField && (
          <div>
            <label className={labelClass}>Is your spouse/partner coming to Canada?</label>
            <select className={selectClass} value={values.spouse_coming_to_canada} onChange={(e) => handleChange("spouse_coming_to_canada", e.target.value)}>
              <option value="">Not specified</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>
        )}

        {/* Education level */}
        <div>
          <label className={labelClass}>Highest level of education</label>
          <input type="text" className={inputClass} placeholder="e.g. Master's in Computer Science" value={values.education_level_voice} onChange={(e) => handleChange("education_level_voice", e.target.value)} />
        </div>

        {/* Years of experience */}
        <div>
          <label className={labelClass}>Total years of skilled work experience</label>
          <input type="number" min={0} max={50} className={inputClass} placeholder="e.g. 5" value={values.years_experience} onChange={(e) => handleChange("years_experience", e.target.value)} />
        </div>

        {/* Canadian experience */}
        <div>
          <label className={labelClass}>Have you ever worked in Canada?</label>
          <select className={selectClass} value={values.has_canadian_experience} onChange={(e) => handleChange("has_canadian_experience", e.target.value)}>
            <option value="">Not specified</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </div>

        {/* Occupation */}
        <div>
          <label className={labelClass}>Current or most recent job title</label>
          <input type="text" className={inputClass} placeholder="e.g. Software Engineer" value={values.occupation} onChange={(e) => handleChange("occupation", e.target.value)} />
        </div>

        {/* Language proficiency */}
        <div>
          <label className={labelClass}>Self-assessed English/French level</label>
          <select className={selectClass} value={values.language_proficiency_self} onChange={(e) => handleChange("language_proficiency_self", e.target.value)}>
            <option value="">Not specified</option>
            <option value="native">Native speaker</option>
            <option value="fluent">Fluent</option>
            <option value="advanced">Advanced</option>
            <option value="intermediate">Intermediate</option>
            <option value="basic">Basic</option>
          </select>
        </div>

        {/* Family in Canada */}
        <div>
          <label className={labelClass}>Do you have family members living in Canada?</label>
          <select className={selectClass} value={values.has_family_in_canada} onChange={(e) => handleChange("has_family_in_canada", e.target.value)}>
            <option value="">Not specified</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </div>

        {/* Intended province */}
        <div>
          <label className={labelClass}>Preferred province (optional)</label>
          <select className={selectClass} value={values.intended_province} onChange={(e) => handleChange("intended_province", e.target.value)}>
            <option value="no_preference">No preference</option>
            <option value="Alberta">Alberta</option>
            <option value="British Columbia">British Columbia</option>
            <option value="Manitoba">Manitoba</option>
            <option value="New Brunswick">New Brunswick</option>
            <option value="Newfoundland and Labrador">Newfoundland and Labrador</option>
            <option value="Nova Scotia">Nova Scotia</option>
            <option value="Ontario">Ontario</option>
            <option value="Prince Edward Island">Prince Edward Island</option>
            <option value="Quebec">Quebec</option>
            <option value="Saskatchewan">Saskatchewan</option>
          </select>
        </div>

        {/* Annual income */}
        <div>
          <label className={labelClass}>Approximate annual income</label>
          <div className="flex gap-2">
            <input type="number" min={0} className={`${inputClass} flex-1`} placeholder="e.g. 60000" value={values.annual_income} onChange={(e) => handleChange("annual_income", e.target.value)} />
            <select
              className="h-10 border border-border rounded-input px-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500 bg-bg-surface transition-colors"
              value={values.income_currency}
              onChange={(e) => handleChange("income_currency", e.target.value)}
            >
              {COMMON_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              <option value="Other">Other</option>
            </select>
          </div>
          {values.income_currency === "Other" && (
            <input
              type="text"
              className={`${inputClass} mt-2`}
              placeholder="Currency code (e.g. MXN)"
              value={values.income_currency_other}
              onChange={(e) => handleChange("income_currency_other", e.target.value)}
            />
          )}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button type="submit" disabled={submitting} className="btn-primary w-full py-2.5 disabled:opacity-50">
          {submitting ? "Saving…" : "Save and continue →"}
        </button>
      </div>
    </form>
  );
}
