import type { VoiceExtractedProfile } from "@/modules/voice/types";

export type FieldGroup = "basics" | "work" | "language" | "education" | "extras";

export interface DisplayField {
  key: string;
  label: string;
  format: (value: unknown) => string | null;
  group: FieldGroup;
}

/** Ordered list of groups for rendering separators. */
export const GROUP_ORDER: ReadonlyArray<FieldGroup> = [
  "basics", "work", "language", "education", "extras",
];

function computeAge(dob: string): number {
  const birth = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}

const EDUCATION_LABELS: Record<string, string> = {
  phd: "PhD",
  masters: "Master's",
  two_or_more_credentials: "2+ credentials",
  bachelors: "Bachelor's",
  two_year_post_secondary: "2-yr college",
  one_year_post_secondary: "1-yr college",
  secondary: "Secondary school",
  less_than_secondary: "Below secondary",
};

function educationLevelToLabel(v: unknown): string | null {
  if (typeof v !== "string") return null;
  return EDUCATION_LABELS[v] ?? v;
}

function yrs(v: unknown): string | null {
  if (v == null) return null;
  const n = Number(v);
  if (isNaN(n) || n <= 0) return null;
  return `${n} yr${n === 1 ? "" : "s"}`;
}

/** Ordered field display definitions for the voice profile panel. */
export const DISPLAY_FIELDS: ReadonlyArray<DisplayField> = [
  // ── BASICS ──
  { key: "current_country", label: "Lives in", format: (v) => (v ? String(v) : null), group: "basics" },
  { key: "nationality", label: "Nationality", format: (v) => (v ? String(v) : null), group: "basics" },
  { key: "destination_country", label: "Destination", format: (v) => (v ? String(v) : null), group: "basics" },
  { key: "purpose", label: "Purpose", format: (v) => (v ? String(v) : null), group: "basics" },
  {
    key: "date_of_birth",
    label: "Age",
    format: (v) => (typeof v === "string" && v ? `${computeAge(v)} years old` : null),
    group: "basics",
  },
  { key: "marital_status", label: "Marital status", format: (v) => (v ? String(v) : null), group: "basics" },
  {
    key: "dependents",
    label: "Dependents",
    format: (v) => (v === 0 ? "None" : v != null ? String(v) : null),
    group: "basics",
  },

  // ── WORK ──
  { key: "occupation", label: "Occupation", format: (v) => (v ? String(v) : null), group: "work" },
  {
    key: "noc_teer_category",
    label: "NOC TEER",
    format: (v) => (v != null ? `TEER ${v}` : null),
    group: "work",
  },
  {
    key: "canadian_work_years",
    label: "Canadian exp.",
    format: (v) => {
      if (v == null) return null;
      const n = Number(v);
      if (isNaN(n)) return null;
      return n === 0 ? "None" : `${n} yr${n === 1 ? "" : "s"}`;
    },
    group: "work",
  },
  { key: "foreign_work_years", label: "Foreign exp.", format: yrs, group: "work" },
  {
    key: "has_canadian_job_offer",
    label: "Job offer (CA)",
    format: (v) => (v === true ? "Yes ✓" : v === false ? "No" : null),
    group: "work",
  },

  // ── LANGUAGE ──
  { key: "clb_speaking", label: "CLB Speaking", format: (v) => (v != null ? `${v}/12` : null), group: "language" },
  { key: "clb_listening", label: "CLB Listening", format: (v) => (v != null ? `${v}/12` : null), group: "language" },
  { key: "clb_reading", label: "CLB Reading", format: (v) => (v != null ? `${v}/12` : null), group: "language" },
  { key: "clb_writing", label: "CLB Writing", format: (v) => (v != null ? `${v}/12` : null), group: "language" },

  // ── EDUCATION ──
  { key: "education_level", label: "Education", format: educationLevelToLabel, group: "education" },
  {
    key: "eca_obtained",
    label: "Credentials (ECA)",
    format: (v) => (v === true ? "Assessed ✓" : v === false ? "Not yet" : null),
    group: "education",
  },

  // ── EXTRAS ──
  {
    key: "has_provincial_nomination",
    label: "Provincial nomination",
    format: (v) => (v === true ? "Yes ✓" : null),
    group: "extras",
  },
  {
    key: "has_sibling_in_canada",
    label: "Sibling in Canada",
    format: (v) => (v === true ? "Yes ✓" : null),
    group: "extras",
  },
  { key: "intended_province", label: "Target province", format: (v) => (v ? String(v) : null), group: "extras" },
];

export interface ResolvedField extends DisplayField {
  formatted: string;
}

/** Resolve all displayable fields from a partial profile, filtering out null/empty values. */
export function resolveDisplayFields(profile: Partial<VoiceExtractedProfile>): ResolvedField[] {
  return DISPLAY_FIELDS.flatMap((field) => {
    const value = (profile as Record<string, unknown>)[field.key];
    const formatted = field.format(value);
    return formatted !== null ? [{ ...field, formatted }] : [];
  });
}
