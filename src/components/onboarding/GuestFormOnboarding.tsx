"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { useGuestSession } from "@/lib/guest-session";

// ─── Design tokens (website) ─────────────────────────────────────────────────

const W = {
  green:      "#0D4A3A",
  greenMuted: "#2A5C4E",
  greenLight: "#E8F0EE",
  greenTint:  "#F2F6F5",
  ink:        "#0D0D0D",
  grey700:    "#3D3D3D",
  grey500:    "#6B6B6B",
  grey300:    "#C4C4C4",
  grey100:    "#F4F4F4",
  white:      "#FFFFFF",
  display:    "var(--pw-font-display)",   // Instrument Serif
  body:       "var(--pw-font-body)",      // DM Sans
};

// ─── Types ───────────────────────────────────────────────────────────────────

type StepType =
  | "text" | "date" | "number" | "choice"
  | "select" | "clb" | "income" | "province" | "multicheck";

type SubmittingPhase = "saving" | "searching" | "ranking" | null;

interface ChoiceOption { value: string; label: string }

interface StepDef {
  id: string;
  question: string;
  hint?: string;
  type: StepType;
  field?: keyof FormValues;
  options?: ChoiceOption[];
  placeholder?: string;
  min?: number;
  max?: number;
  clbFields?: [keyof FormValues, keyof FormValues, keyof FormValues, keyof FormValues];
  showIf?: (v: FormValues) => boolean;
}

type FormValues = {
  full_name: string;
  date_of_birth: string;
  nationality: string;
  current_country: string;
  marital_status: string;
  spouse_coming_to_canada: string;
  spouse_education_level: string;
  has_spouse_language_test: string;
  spouse_clb_speaking: string;
  spouse_clb_listening: string;
  spouse_clb_reading: string;
  spouse_clb_writing: string;
  spouse_canadian_work_years: string;
  occupation: string;
  years_experience: string;
  has_canadian_experience: string;
  canadian_work_years: string;
  canadian_work_recent: string;
  education_level: string;
  language_proficiency_self: string;
  has_language_test: string;
  clb_speaking: string;
  clb_listening: string;
  clb_reading: string;
  clb_writing: string;
  has_family_in_canada: string;
  intended_province: string;
  annual_income: string;
  income_currency: string;
  has_canadian_job_offer: string;
  has_provincial_nomination: string;
  has_sibling_in_canada: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const EDUCATION_OPTIONS: ChoiceOption[] = [
  { value: "less_than_secondary",     label: "Less than high school" },
  { value: "secondary",               label: "High school diploma or GED" },
  { value: "one_year_post_secondary", label: "One-year college diploma" },
  { value: "two_year_post_secondary", label: "Two-year college diploma" },
  { value: "bachelors",               label: "Bachelor's degree" },
  { value: "two_or_more_credentials", label: "Two or more post-secondary credentials" },
  { value: "masters",                 label: "Master's degree or MBA" },
  { value: "phd",                     label: "PhD or doctorate" },
];

const EDUCATION_LABELS: Record<string, string> = Object.fromEntries(
  EDUCATION_OPTIONS.map((o) => [o.value, o.label])
);

const CLB_FROM_PROFICIENCY: Record<string, number> = {
  native: 10, fluent: 9, advanced: 8, intermediate: 7, basic: 5,
};

const PROVINCES = [
  "Alberta", "British Columbia", "Manitoba", "New Brunswick",
  "Newfoundland and Labrador", "Nova Scotia", "Ontario",
  "Prince Edward Island", "Quebec", "Saskatchewan",
  "Northwest Territories", "Nunavut", "Yukon",
];

const CURRENCIES = ["CAD", "USD", "GBP", "EUR", "INR", "AUD", "NGN", "PKR", "PHP"];

const BONUS_OPTIONS = [
  {
    field: "has_canadian_job_offer" as keyof FormValues,
    label: "I have a job offer from a Canadian employer",
    hint: "Can add up to 200 CRS points",
  },
  {
    field: "has_provincial_nomination" as keyof FormValues,
    label: "I have a provincial nomination",
    hint: "Adds 600 CRS points — nearly guarantees an invitation",
  },
  {
    field: "has_sibling_in_canada" as keyof FormValues,
    label: "I have a sibling who is a Canadian citizen or permanent resident",
    hint: "Adds 15 CRS points to your profile",
  },
];

const isMarried = (v: FormValues) =>
  ["married", "common_law", "common-law"].includes(v.marital_status);

const STEPS: StepDef[] = [
  { id: "full_name",     question: "What's your full name?",               type: "text",   field: "full_name",     placeholder: "e.g. Priya Sharma" },
  { id: "date_of_birth", question: "When were you born?",                  type: "date",   field: "date_of_birth", hint: "Used to assess age-based eligibility criteria." },
  { id: "nationality",   question: "What is your nationality?",            type: "text",   field: "nationality",   placeholder: "e.g. Indian, Brazilian", hint: "Your country or countries of citizenship." },
  { id: "current_country", question: "Where do you currently live?",       type: "text",   field: "current_country", placeholder: "e.g. United Kingdom" },
  {
    id: "marital_status", question: "What is your marital status?", type: "choice", field: "marital_status",
    options: [
      { value: "single",     label: "Single" },
      { value: "married",    label: "Married" },
      { value: "common_law", label: "Common-law" },
      { value: "separated",  label: "Separated" },
      { value: "divorced",   label: "Divorced" },
      { value: "widowed",    label: "Widowed" },
    ],
  },
  {
    id: "spouse_coming", question: "Is your spouse or partner also planning to move to Canada?",
    type: "choice", field: "spouse_coming_to_canada",
    options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }],
    showIf: isMarried,
  },
  {
    id: "spouse_education", question: "What is your spouse's highest level of education?",
    type: "select", field: "spouse_education_level", options: EDUCATION_OPTIONS,
    showIf: (v) => isMarried(v) && v.spouse_coming_to_canada === "yes",
  },
  {
    id: "has_spouse_language_test", question: "Has your spouse taken a language test?",
    hint: "IELTS, CELPIP, TEF, or TCF",
    type: "choice", field: "has_spouse_language_test",
    options: [{ value: "yes", label: "Yes" }, { value: "no", label: "Not yet" }],
    showIf: (v) => isMarried(v) && v.spouse_coming_to_canada === "yes",
  },
  {
    id: "spouse_clb", question: "What were your spouse's CLB scores?",
    hint: "Canadian Language Benchmark score for each skill (scale 1–12).",
    type: "clb", clbFields: ["spouse_clb_speaking", "spouse_clb_listening", "spouse_clb_reading", "spouse_clb_writing"],
    showIf: (v) => isMarried(v) && v.spouse_coming_to_canada === "yes" && v.has_spouse_language_test === "yes",
  },
  {
    id: "spouse_canadian_work", question: "How many years has your spouse worked in Canada?",
    hint: "Enter 0 if they have no Canadian work experience.",
    type: "number", field: "spouse_canadian_work_years", min: 0, max: 50, placeholder: "0",
    showIf: (v) => isMarried(v) && v.spouse_coming_to_canada === "yes",
  },
  { id: "occupation",       question: "What is your current or most recent job title?",         type: "text",   field: "occupation",       placeholder: "e.g. Software Engineer" },
  { id: "years_experience", question: "How many years of skilled work experience do you have?", type: "number", field: "years_experience",  min: 0, max: 60, placeholder: "e.g. 5", hint: "Count all professional or trade work since completing your studies." },
  {
    id: "has_canadian_experience", question: "Have you ever worked in Canada?",
    type: "choice", field: "has_canadian_experience",
    options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }],
  },
  {
    id: "canadian_work_years", question: "How many years have you worked in Canada?",
    type: "number", field: "canadian_work_years", min: 0, max: 60, placeholder: "e.g. 2",
    showIf: (v) => v.has_canadian_experience === "yes",
  },
  {
    id: "canadian_work_recent", question: "Was any of that Canadian experience in the last 3 years?",
    type: "choice", field: "canadian_work_recent",
    options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }],
    showIf: (v) => v.has_canadian_experience === "yes",
  },
  { id: "education_level",  question: "What is your highest level of education?",                type: "select", field: "education_level",  options: EDUCATION_OPTIONS },
  {
    id: "language_level", question: "How would you describe your English or French proficiency?",
    type: "choice", field: "language_proficiency_self",
    options: [
      { value: "native",       label: "Native speaker" },
      { value: "fluent",       label: "Fluent" },
      { value: "advanced",     label: "Advanced" },
      { value: "intermediate", label: "Intermediate" },
      { value: "basic",        label: "Basic" },
    ],
  },
  {
    id: "has_language_test", question: "Have you taken a language test?",
    hint: "IELTS, CELPIP, TEF, or TCF",
    type: "choice", field: "has_language_test",
    options: [{ value: "yes", label: "Yes" }, { value: "no", label: "Not yet" }],
  },
  {
    id: "clb_scores", question: "What were your CLB scores?",
    hint: "Canadian Language Benchmark score for each skill (scale 1–12).",
    type: "clb", clbFields: ["clb_speaking", "clb_listening", "clb_reading", "clb_writing"],
    showIf: (v) => v.has_language_test === "yes",
  },
  {
    id: "has_family", question: "Do you have any family members living in Canada?",
    hint: "Includes siblings, parents, or other close relatives.",
    type: "choice", field: "has_family_in_canada",
    options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }],
  },
  { id: "province", question: "Do you have a preferred province or territory?", hint: "Some provincial programs have higher acceptance rates — this helps us prioritize.", type: "province", field: "intended_province" },
  { id: "income",   question: "What is your approximate annual income?",         hint: "Helps us check income thresholds for certain pathways.",                             type: "income",   field: "annual_income" },
  { id: "bonus",    question: "A few things that could significantly improve your options.", hint: "Select all that apply — these can dramatically affect your eligibility.", type: "multicheck" },
];

const INITIAL_VALUES: FormValues = {
  full_name: "", date_of_birth: "", nationality: "", current_country: "",
  marital_status: "", spouse_coming_to_canada: "", spouse_education_level: "",
  has_spouse_language_test: "", spouse_clb_speaking: "", spouse_clb_listening: "",
  spouse_clb_reading: "", spouse_clb_writing: "", spouse_canadian_work_years: "",
  occupation: "", years_experience: "", has_canadian_experience: "",
  canadian_work_years: "", canadian_work_recent: "", education_level: "",
  language_proficiency_self: "", has_language_test: "", clb_speaking: "",
  clb_listening: "", clb_reading: "", clb_writing: "", has_family_in_canada: "",
  intended_province: "no_preference", annual_income: "", income_currency: "CAD",
  has_canadian_job_offer: "", has_provincial_nomination: "", has_sibling_in_canada: "",
};

// ─── Payload builder ─────────────────────────────────────────────────────────

/** Maps form values to the guest onboarding data format consumed by the matcher. */
function buildPayload(v: FormValues): Record<string, unknown> {
  const d: Record<string, unknown> = {};

  if (v.full_name)      d.full_name      = v.full_name;
  if (v.date_of_birth)  d.date_of_birth  = v.date_of_birth;
  if (v.nationality)    d.nationality    = v.nationality;
  if (v.current_country) d.current_country = v.current_country;
  if (v.marital_status)  d.marital_status  = v.marital_status;

  if (isMarried(v)) {
    d.spouse_coming_to_canada = v.spouse_coming_to_canada === "yes";
    if (v.spouse_coming_to_canada === "yes") {
      if (v.spouse_education_level) d.spouse_education_level = v.spouse_education_level;
      if (v.has_spouse_language_test === "yes") {
        (["spouse_clb_speaking", "spouse_clb_listening", "spouse_clb_reading", "spouse_clb_writing"] as const).forEach((f) => {
          const n = parseInt(v[f]); if (!isNaN(n)) d[f] = n;
        });
      }
      const scwy = parseInt(v.spouse_canadian_work_years);
      if (!isNaN(scwy)) d.spouse_canadian_work_years = scwy;
    }
  }

  if (v.occupation) d.occupation = v.occupation;

  const ye = parseInt(v.years_experience);
  if (!isNaN(ye)) {
    d.years_experience = ye;
    const hasCA = v.has_canadian_experience === "yes";
    const cwy   = hasCA ? (parseInt(v.canadian_work_years) || 0) : 0;
    d.has_canadian_experience = hasCA;
    d.canadian_work_years     = cwy;
    d.foreign_work_years      = Math.max(0, ye - cwy);
    d.canadian_work_recent    = hasCA && v.canadian_work_recent === "yes";
    d.foreign_work_recent     = !hasCA && ye > 0;
  }

  if (v.education_level) {
    d.education_level       = v.education_level;
    d.education_level_voice = EDUCATION_LABELS[v.education_level] ?? v.education_level;
  }

  if (v.language_proficiency_self) d.language_proficiency_self = v.language_proficiency_self;

  if (v.has_language_test === "yes") {
    (["clb_speaking", "clb_listening", "clb_reading", "clb_writing"] as const).forEach((f) => {
      const n = parseInt(v[f]); if (!isNaN(n)) d[f] = n;
    });
  } else if (v.language_proficiency_self) {
    const inferred = CLB_FROM_PROFICIENCY[v.language_proficiency_self];
    if (inferred) { d.clb_speaking = d.clb_listening = d.clb_reading = d.clb_writing = inferred; }
  }

  if (v.has_family_in_canada) d.has_family_in_canada = v.has_family_in_canada === "yes";
  if (v.intended_province && v.intended_province !== "no_preference") d.intended_province = v.intended_province;

  const ai = parseInt(v.annual_income);
  if (!isNaN(ai)) { d.annual_income = ai; d.income_currency = v.income_currency || "CAD"; }

  d.has_canadian_job_offer   = v.has_canadian_job_offer   === "yes";
  d.has_provincial_nomination = v.has_provincial_nomination === "yes";
  d.has_sibling_in_canada    = v.has_sibling_in_canada    === "yes";
  d.destination_country      = "Canada";

  return d;
}

// ─── Loading overlay ─────────────────────────────────────────────────────────

const OVERLAY_STEPS: Array<{ key: NonNullable<SubmittingPhase>; label: string }> = [
  { key: "saving",    label: "Saving your answers" },
  { key: "searching", label: "Searching immigration programs" },
  { key: "ranking",   label: "Ranking your matches" },
];

function MatchingLoadingOverlay({ phase }: { phase: NonNullable<SubmittingPhase> }) {
  const activeIdx = OVERLAY_STEPS.findIndex(s => s.key === phase);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100,
      backgroundColor: W.green,
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
    }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 48, padding: "0 32px" }}>
        <span style={{ fontFamily: W.display, fontSize: 22, color: W.white, letterSpacing: "-0.01em" }}>
          Pathways
        </span>

        {/* Progress dots */}
        <div style={{ display: "flex", gap: 10 }}>
          {OVERLAY_STEPS.map((_, i) => (
            <div
              key={i}
              className={i === activeIdx ? "animate-pulse" : ""}
              style={{
                width: 8, height: 8, borderRadius: 9999,
                backgroundColor: i < activeIdx
                  ? "rgba(255,255,255,0.7)"
                  : i === activeIdx
                    ? W.white
                    : "rgba(255,255,255,0.18)",
                transition: "background-color 0.4s ease",
              }}
            />
          ))}
        </div>

        {/* Step list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16, width: "min(100%, 300px)" }}>
          {OVERLAY_STEPS.map(({ key, label }, i) => {
            const done   = i < activeIdx;
            const active = i === activeIdx;
            return (
              <div key={key} style={{
                display: "flex", alignItems: "center", gap: 14,
                opacity: done || active ? 1 : 0.25,
                transition: "opacity 0.5s ease",
              }}>
                <div style={{
                  width: 22, height: 22, borderRadius: 9999, flexShrink: 0,
                  backgroundColor: done ? "rgba(255,255,255,0.88)" : "transparent",
                  border: done ? "none" : `1.5px solid rgba(255,255,255,${active ? "0.45" : "0.15"})`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {done  && <Check size={12} color={W.green} strokeWidth={2.5} />}
                  {active && (
                    <div
                      className="animate-pulse"
                      style={{ width: 7, height: 7, borderRadius: 9999, backgroundColor: W.white }}
                    />
                  )}
                </div>
                <span style={{
                  fontFamily: W.body, fontSize: 14,
                  color: active ? W.white : done ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.25)",
                  fontWeight: active ? 500 : 400,
                  transition: "color 0.4s ease",
                }}>
                  {label}
                </span>
              </div>
            );
          })}
        </div>

        <p style={{ fontFamily: W.body, fontSize: 12, color: "rgba(255,255,255,0.28)", textAlign: "center", maxWidth: 220, lineHeight: 1.6 }}>
          This usually takes 10–20 seconds.
        </p>
      </div>
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

/** Step-by-step guest onboarding form — one question per screen, website design language. */
export function GuestFormOnboarding() {
  const router = useRouter();
  const { token, loading: sessionLoading, error: sessionError } = useGuestSession();

  const [values,      setValues]      = useState<FormValues>(INITIAL_VALUES);
  const [stepIndex,   setStepIndex]   = useState(0);
  const [direction,   setDirection]   = useState<"forward" | "backward">("forward");
  const [submittingPhase, setSubmittingPhase] = useState<SubmittingPhase>(null);
  const [submitError,     setSubmitError]     = useState<string | null>(null);
  const submitting = submittingPhase !== null;

  const activeSteps = useMemo(
    () => STEPS.filter((s) => !s.showIf || s.showIf(values)),
    [values]
  );

  useEffect(() => {
    if (stepIndex >= activeSteps.length) setStepIndex(activeSteps.length - 1);
  }, [activeSteps, stepIndex]);

  const currentStep = activeSteps[stepIndex];
  const isLastStep  = stepIndex === activeSteps.length - 1;
  const progress    = ((stepIndex + 1) / activeSteps.length) * 100;

  const canAdvance = useCallback((): boolean => {
    if (!currentStep) return false;
    switch (currentStep.type) {
      case "text":   return ((values[currentStep.field!] as string) ?? "").trim().length > 0;
      case "date":   return ((values[currentStep.field!] as string) ?? "").length > 0;
      case "number": { const v = (values[currentStep.field!] as string) ?? ""; return v !== "" && !isNaN(Number(v)) && Number(v) >= 0; }
      case "select": return ((values[currentStep.field!] as string) ?? "") !== "";
      case "clb":    return (currentStep.clbFields ?? []).every((f) => { const v = (values[f] as string) ?? ""; const n = parseInt(v); return v !== "" && !isNaN(n) && n >= 1 && n <= 12; });
      case "income": return (values.annual_income ?? "").trim() !== "";
      default:       return true;
    }
  }, [currentStep, values]);

  function setValue(field: keyof FormValues, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  function advance() {
    if (!canAdvance()) return;
    if (isLastStep) { void handleSubmit(); return; }
    setDirection("forward");
    setStepIndex((i) => i + 1);
  }

  function goBack() {
    if (stepIndex === 0) { router.push("/onboarding"); return; }
    setDirection("backward");
    setStepIndex((i) => i - 1);
  }

  function handleChoiceSelect(field: keyof FormValues, value: string) {
    setValue(field, value);
    setTimeout(() => {
      if (isLastStep) { void handleSubmit(); }
      else { setDirection("forward"); setStepIndex((i) => i + 1); }
    }, 220);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey && currentStep?.type !== "choice") {
      e.preventDefault(); advance();
    }
  }

  async function handleSubmit() {
    if (!token) return;
    setSubmittingPhase("saving");
    setSubmitError(null);
    try {
      // Phase 1 — save answers
      const patchRes = await fetch(`/api/guest/${token}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ onboarding_data: buildPayload(values) }),
      });
      if (!patchRes.ok) {
        const d = (await patchRes.json()) as { error?: { message: string } };
        throw new Error(d.error?.message ?? "Could not save your answers.");
      }

      // Phase 2 — run matching (brief pause so the "searching" step is visible)
      setSubmittingPhase("searching");
      await new Promise<void>(r => setTimeout(r, 900));
      setSubmittingPhase("ranking");

      // Try matching up to 2 times; navigate to results regardless of outcome.
      // The results page shows a "still computing" state when pathway_results is null.
      for (let attempt = 0; attempt < 2; attempt++) {
        const matchRes = await fetch("/api/guest/match", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        if (matchRes.ok) break;
        if (attempt === 0) await new Promise<void>(r => setTimeout(r, 2000));
      }

      router.push(`/results/${token}`);
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setSubmitError(raw.replace(/^(InternalError|ValidationError|DatabaseError|NotFoundError): /, ""));
      setSubmittingPhase(null);
    }
  }

  // ─── Loading / error ──────────────────────────────────────────────────────

  if (submittingPhase !== null) {
    return <MatchingLoadingOverlay phase={submittingPhase} />;
  }

  if (sessionLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", backgroundColor: W.greenTint }}>
        <p style={{ color: W.grey500, fontFamily: W.body, fontSize: 14 }}>Starting session…</p>
      </div>
    );
  }

  if (sessionError || !token) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", backgroundColor: W.greenTint }}>
        <p style={{ color: "#DC2626", fontFamily: W.body, fontSize: 14 }}>Could not start a session. Please refresh the page.</p>
      </div>
    );
  }

  if (!currentStep) return null;

  // ─── Field renderer ───────────────────────────────────────────────────────

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "transparent",
    border: "none",
    borderBottom: `2px solid ${W.grey300}`,
    outline: "none",
    fontFamily: W.body,
    fontSize: 20,
    fontWeight: 400,
    color: W.ink,
    padding: "10px 0",
    transition: "border-color 150ms ease",
  };

  function renderField(): React.ReactNode {
    switch (currentStep.type) {

      case "text":
        return (
          <input key={currentStep.id} type="text" autoFocus
            style={inputStyle} placeholder={currentStep.placeholder ?? ""}
            value={(values[currentStep.field!] as string) ?? ""}
            onChange={(e) => setValue(currentStep.field!, e.target.value)}
            onFocus={(e) => { e.currentTarget.style.borderBottomColor = W.green; }}
            onBlur={(e)  => { e.currentTarget.style.borderBottomColor = W.grey300; }}
          />
        );

      case "date":
        return (
          <input key={currentStep.id} type="date" autoFocus
            style={inputStyle}
            value={(values[currentStep.field!] as string) ?? ""}
            onChange={(e) => setValue(currentStep.field!, e.target.value)}
            onFocus={(e) => { e.currentTarget.style.borderBottomColor = W.green; }}
            onBlur={(e)  => { e.currentTarget.style.borderBottomColor = W.grey300; }}
          />
        );

      case "number":
        return (
          <input key={currentStep.id} type="number" autoFocus
            min={currentStep.min} max={currentStep.max}
            style={inputStyle} placeholder={currentStep.placeholder ?? ""}
            value={(values[currentStep.field!] as string) ?? ""}
            onChange={(e) => setValue(currentStep.field!, e.target.value)}
            onFocus={(e) => { e.currentTarget.style.borderBottomColor = W.green; }}
            onBlur={(e)  => { e.currentTarget.style.borderBottomColor = W.grey300; }}
          />
        );

      case "choice": {
        const selected = (values[currentStep.field!] as string) ?? "";
        const cols = currentStep.options!.length === 2 ? 2 : 3;
        return (
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 12, marginTop: 16 }}>
            {currentStep.options!.map((opt) => {
              const isSelected = selected === opt.value;
              return (
                <button key={opt.value}
                  onClick={() => handleChoiceSelect(currentStep.field!, opt.value)}
                  style={{
                    padding: "14px 16px",
                    border: `2px solid ${isSelected ? W.green : W.grey300}`,
                    borderRadius: 8,
                    background: isSelected ? W.greenLight : W.white,
                    color: isSelected ? W.green : W.grey700,
                    fontFamily: W.body,
                    fontSize: 15,
                    fontWeight: isSelected ? 500 : 400,
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 150ms ease",
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.borderColor = W.greenMuted;
                      e.currentTarget.style.background = W.greenTint;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.borderColor = W.grey300;
                      e.currentTarget.style.background = W.white;
                    }
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        );
      }

      case "select":
        return (
          <select key={currentStep.id} autoFocus
            style={{ ...inputStyle, cursor: "pointer" }}
            value={(values[currentStep.field!] as string) ?? ""}
            onChange={(e) => setValue(currentStep.field!, e.target.value)}
            onFocus={(e) => { e.currentTarget.style.borderBottomColor = W.green; }}
            onBlur={(e)  => { e.currentTarget.style.borderBottomColor = W.grey300; }}
          >
            <option value="">Select…</option>
            {currentStep.options!.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        );

      case "clb": {
        const labels = ["Speaking", "Listening", "Reading", "Writing"];
        return (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20, marginTop: 16 }}>
            {(currentStep.clbFields ?? []).map((field, i) => (
              <div key={String(field)}>
                <p style={{ fontFamily: W.body, fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.1em", color: W.grey500, marginBottom: 10 }}>
                  {labels[i]}
                </p>
                <input type="number" min={1} max={12}
                  style={{ ...inputStyle, fontSize: 28, fontWeight: 600, textAlign: "center" }}
                  placeholder="–"
                  value={(values[field] as string) ?? ""}
                  onChange={(e) => setValue(field, e.target.value)}
                  onFocus={(e) => { e.currentTarget.style.borderBottomColor = W.green; }}
                  onBlur={(e)  => { e.currentTarget.style.borderBottomColor = W.grey300; }}
                />
              </div>
            ))}
          </div>
        );
      }

      case "income":
        return (
          <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
            <input key={currentStep.id} type="number" autoFocus min={0}
              style={{ ...inputStyle, flex: 1 }} placeholder="e.g. 60,000"
              value={values.annual_income ?? ""}
              onChange={(e) => setValue("annual_income", e.target.value)}
              onFocus={(e) => { e.currentTarget.style.borderBottomColor = W.green; }}
              onBlur={(e)  => { e.currentTarget.style.borderBottomColor = W.grey300; }}
            />
            <select
              style={{ ...inputStyle, width: 80, fontSize: 16, cursor: "pointer" }}
              value={values.income_currency ?? "CAD"}
              onChange={(e) => setValue("income_currency", e.target.value)}
              onFocus={(e) => { e.currentTarget.style.borderBottomColor = W.green; }}
              onBlur={(e)  => { e.currentTarget.style.borderBottomColor = W.grey300; }}
            >
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        );

      case "province":
        return (
          <select key={currentStep.id} autoFocus
            style={{ ...inputStyle, cursor: "pointer" }}
            value={values.intended_province ?? "no_preference"}
            onChange={(e) => setValue("intended_province", e.target.value)}
            onFocus={(e) => { e.currentTarget.style.borderBottomColor = W.green; }}
            onBlur={(e)  => { e.currentTarget.style.borderBottomColor = W.grey300; }}
          >
            <option value="no_preference">No preference</option>
            {PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        );

      case "multicheck":
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
            {BONUS_OPTIONS.map((opt) => {
              const checked = values[opt.field] === "yes";
              return (
                <label key={String(opt.field)}
                  style={{
                    display: "flex", alignItems: "flex-start", gap: 16,
                    padding: "14px 16px",
                    border: `1.5px solid ${checked ? W.green : W.grey300}`,
                    borderRadius: 8,
                    background: checked ? W.greenLight : W.white,
                    cursor: "pointer",
                    transition: "all 150ms ease",
                  }}
                >
                  <input type="checkbox" checked={checked}
                    onChange={(e) => setValue(opt.field, e.target.checked ? "yes" : "no")}
                    style={{ position: "absolute", opacity: 0, width: 0, height: 0 }}
                  />
                  <div style={{
                    width: 20, height: 20, borderRadius: 4, flexShrink: 0, marginTop: 1,
                    border: `2px solid ${checked ? W.green : W.grey300}`,
                    background: checked ? W.green : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all 150ms ease",
                  }}>
                    {checked && <Check size={11} color={W.white} strokeWidth={2.5} />}
                  </div>
                  <div>
                    <p style={{ fontFamily: W.body, fontSize: 14, fontWeight: 500, color: W.ink, lineHeight: 1.4 }}>{opt.label}</p>
                    <p style={{ fontFamily: W.body, fontSize: 12, color: W.grey500, marginTop: 2 }}>{opt.hint}</p>
                  </div>
                </label>
              );
            })}
          </div>
        );

      default: return null;
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div
      onKeyDown={handleKeyDown}
      style={{ minHeight: "100vh", backgroundColor: W.white, display: "flex", flexDirection: "column", fontFamily: W.body }}
    >
      {/* Top bar */}
      <header style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 40px", height: 64,
        borderBottom: `1px solid ${W.grey300}`,
        flexShrink: 0,
      }}>
        <button onClick={goBack}
          style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, color: W.grey500, background: "none", border: "none", cursor: "pointer", fontFamily: W.body }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = W.ink; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = W.grey500; }}
        >
          <ArrowLeft size={16} />
          Back
        </button>
        <span style={{ fontFamily: W.body, fontWeight: 600, fontSize: 16, color: W.ink }}>Pathways</span>
        <span style={{ fontFamily: W.body, fontSize: 13, color: W.grey500 }}>
          {stepIndex + 1} / {activeSteps.length}
        </span>
      </header>

      {/* Progress bar */}
      <div style={{ height: 2, backgroundColor: W.grey100, flexShrink: 0 }}>
        <div style={{
          height: "100%", backgroundColor: W.green,
          width: `${progress}%`,
          transition: "width 500ms cubic-bezier(0.4, 0, 0.2, 1)",
        }} />
      </div>

      {/* Question */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 24px" }}>
        <div
          key={`${stepIndex}-${direction}`}
          className={direction === "forward" ? "step-slide-forward" : "step-slide-backward"}
          style={{ width: "100%", maxWidth: 560 }}
        >
          {/* Counter */}
          <p style={{
            fontFamily: W.body, fontSize: 11, fontWeight: 500,
            textTransform: "uppercase", letterSpacing: "0.12em",
            color: W.grey300, marginBottom: 20,
          }}>
            {String(stepIndex + 1).padStart(2, "0")} →
          </p>

          {/* Question — Instrument Serif display font */}
          <h1 style={{
            fontFamily: W.display,
            fontWeight: 400,
            fontSize: "clamp(1.6rem, 4vw, 2.1rem)",
            lineHeight: 1.18,
            color: W.ink,
            letterSpacing: "-0.01em",
            marginBottom: currentStep.hint ? 10 : 28,
          }}>
            {currentStep.question}
          </h1>

          {/* Hint */}
          {currentStep.hint && (
            <p style={{ fontFamily: W.body, fontSize: 14, color: W.grey500, marginBottom: 28, lineHeight: 1.55 }}>
              {currentStep.hint}
            </p>
          )}

          {/* Answer field */}
          {renderField()}

          {/* Error */}
          {submitError && (
            <p style={{ fontFamily: W.body, fontSize: 14, color: "#DC2626", marginTop: 16 }}>{submitError}</p>
          )}

          {/* Continue — not shown for choice (auto-advances) */}
          {currentStep.type !== "choice" && (
            <div style={{ marginTop: 40, display: "flex", alignItems: "center", gap: 20 }}>
              <button
                onClick={advance}
                disabled={!canAdvance() || submitting}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  padding: "13px 28px",
                  backgroundColor: (!canAdvance() || submitting) ? W.grey300 : W.green,
                  color: W.white,
                  border: "none", borderRadius: 6,
                  fontFamily: W.body, fontSize: 15, fontWeight: 500,
                  cursor: (!canAdvance() || submitting) ? "not-allowed" : "pointer",
                  transition: "background 150ms ease, transform 120ms ease",
                }}
                onMouseEnter={(e) => { if (canAdvance() && !submitting) (e.currentTarget as HTMLElement).style.backgroundColor = W.greenMuted; }}
                onMouseLeave={(e) => { if (canAdvance() && !submitting) (e.currentTarget as HTMLElement).style.backgroundColor = W.green; }}
              >
                {submitting ? "Finding your pathways…" : isLastStep ? "View my results" : <>Continue <ArrowRight size={15} /></>}
              </button>
              {!submitting && (
                <span style={{ fontFamily: W.body, fontSize: 12, color: W.grey300 }}>
                  or press Enter ↵
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer style={{ flexShrink: 0, padding: "0 24px 24px", textAlign: "center" }}>
        <p style={{ fontFamily: W.body, fontSize: 12, color: W.grey300 }}>
          No account needed — your results are saved for 7 days.
        </p>
      </footer>
    </div>
  );
}
