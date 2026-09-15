import type { Logger } from "pino";
import type { Database } from "@/types/database";
import { logger as defaultLogger } from "@/lib/logger";

/** Every column that exists on the `profiles` table, derived from the generated types. */
type ProfileColumn = keyof Database["public"]["Tables"]["profiles"]["Row"];

/**
 * Columns written only by the database itself or by trusted server code, never by a
 * user-supplied profile payload.
 *
 * Classification is taken from the migrations, not from convention:
 *  - `id` / `created_at` / `updated_at` — defaults and the `set_profiles_updated_at`
 *    trigger (20260515000004_profiles.sql).
 *  - `auth_user_id` / `email` — populated by the `handle_new_user` trigger from
 *    `auth.users` (20260515000004_profiles.sql).
 *  - `is_admin` / `subscription_status` — frozen against the anon/authenticated roles by
 *    the `enforce_protected_profile_columns` trigger
 *    (20260708000001_fix_profile_and_posts_authz.sql).
 *  - `onboarding_status` / `onboarding_step` / `onboarding_method` — the onboarding state
 *    machine, advanced server-side (20260527000001_preflow_redesign.sql).
 *  - `voice_session_data` / `pathway_input_json` — server-written JSONB payload stores.
 *  - `profile_completeness_pct` / `incomplete_fields` / `voice_profile_version` — derived
 *    or server-incremented tracking fields (20260521081846_expand_profiles.sql).
 *  - `selected_pathway_slug` — set by the pathway selection action, not by onboarding
 *    (20260609000001_add_selected_pathway_slug.sql).
 *  - `owner_profile_id` — links a co-applicant to its owning profile; set only by the
 *    co-applicant flow, never by a payload (20260817000001_co_applicant_profiles.sql).
 */
export const SYSTEM_MANAGED_COLUMNS = [
  "auth_user_id",
  "created_at",
  "email",
  "id",
  "incomplete_fields",
  "is_admin",
  "onboarding_method",
  "onboarding_status",
  "onboarding_step",
  "owner_profile_id",
  "pathway_input_json",
  "profile_completeness_pct",
  "selected_pathway_slug",
  "subscription_status",
  "updated_at",
  "voice_profile_version",
  "voice_session_data",
] as const satisfies readonly ProfileColumn[];

/**
 * Columns a user-supplied profile payload may write. Everything on `profiles` that is not
 * in {@link SYSTEM_MANAGED_COLUMNS}: self-reported immigration facts, language scores,
 * work and education history, spouse details, and account contact fields.
 */
export const WRITABLE_PROFILE_COLUMNS = [
  "annual_income",
  "avatar_url",
  "canadian_education_years",
  "canadian_work_recent",
  "canadian_work_years",
  "clb_listening",
  "clb_reading",
  "clb_speaking",
  "clb_writing",
  "country_of_residence",
  "current_country",
  "date_of_birth",
  "degree_field",
  "degree_level",
  "dependents",
  "destination_country",
  "eca_obtained",
  "education_level",
  "education_level_voice",
  "english_level",
  "foreign_work_recent",
  "foreign_work_years",
  "full_name",
  "has_canadian_experience",
  "has_canadian_job_offer",
  "has_criminal_record",
  "has_degree",
  "has_dependents",
  "has_family_in_canada",
  "has_prior_canadian_study",
  "has_provincial_nomination",
  "has_sibling_in_canada",
  "has_trade_certificate",
  "income_currency",
  "intended_province",
  "language_proficiency_self",
  "marital_status",
  "nationality",
  "nclc_listening",
  "nclc_reading",
  "nclc_speaking",
  "nclc_writing",
  "noc_code",
  "noc_teer_category",
  "occupation",
  "phone",
  "preferred_language",
  "purpose",
  "second_lang_listening",
  "second_lang_reading",
  "second_lang_speaking",
  "second_lang_writing",
  "spouse_canadian_work_years",
  "spouse_clb_listening",
  "spouse_clb_reading",
  "spouse_clb_speaking",
  "spouse_clb_writing",
  "spouse_coming_to_canada",
  "spouse_education_level",
  "years_experience",
] as const satisfies readonly ProfileColumn[];

/**
 * Keys the onboarding schemas accept that have no `profiles` column. They are carried in
 * JSONB (`voice_session_data`) instead of being written as columns, so they must never
 * reach a PostgREST update. Adding a column for one of these is a schema change and needs
 * a proposed migration — do not widen this list to paper over a missing column.
 *
 * Currently empty: the last four extras became columns in
 * 20260914000001_add_onboarding_profile_columns.sql.
 */
export const INTENTIONAL_EXTRAS = [] as const satisfies readonly string[];

export type SystemManagedColumn = (typeof SYSTEM_MANAGED_COLUMNS)[number];
export type WritableProfileColumn = (typeof WRITABLE_PROFILE_COLUMNS)[number];
export type IntentionalExtra = (typeof INTENTIONAL_EXTRAS)[number];

type Assert<T extends true> = T;
type Equals<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
  ? true
  : false;

// Compile-time partition check: adding a column to `profiles` and regenerating
// src/types/database.ts breaks the build until the column is classified above.
type _EveryColumnIsClassified = Assert<
  Equals<ProfileColumn, SystemManagedColumn | WritableProfileColumn>
>;
type _NoColumnIsClassifiedTwice = Assert<
  Equals<Extract<SystemManagedColumn, WritableProfileColumn>, never>
>;
type _ExtrasAreNotColumns = Assert<Equals<Extract<IntentionalExtra, ProfileColumn>, never>>;

const WRITABLE_LOOKUP: ReadonlySet<string> = new Set(WRITABLE_PROFILE_COLUMNS);
const EXTRAS_LOOKUP: ReadonlySet<string> = new Set(INTENTIONAL_EXTRAS);

/** The result of splitting a profile payload into its three destinations. */
export interface PartitionedProfilePayload {
  /** Keys safe to send to a `profiles` update. */
  columns: Partial<Record<WritableProfileColumn, unknown>>;
  /** Keys that belong in JSONB rather than a column. */
  extras: Partial<Record<IntentionalExtra, unknown>>;
  /** Keys that are system-managed, unknown, or otherwise not accepted. */
  rejected: string[];
}

/**
 * Split an arbitrary profile payload into writable columns, JSONB extras, and rejected
 * keys. Never throws: anything unrecognised — including system-managed columns such as
 * `is_admin` — lands in `rejected` and is logged at warn level.
 */
export function partitionProfilePayload(
  input: unknown,
  log: Logger = defaultLogger
): PartitionedProfilePayload {
  const columns: Partial<Record<WritableProfileColumn, unknown>> = {};
  const extraEntries: [string, unknown][] = [];
  const rejected: string[] = [];

  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    log.warn({ action: "profile.payload.partition.not_an_object", received: typeof input });
    return { columns, extras: {}, rejected };
  }

  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (WRITABLE_LOOKUP.has(key)) {
      columns[key as WritableProfileColumn] = value;
    } else if (EXTRAS_LOOKUP.has(key)) {
      extraEntries.push([key, value]);
    } else {
      rejected.push(key);
    }
  }

  if (rejected.length > 0) {
    log.warn({ action: "profile.payload.partition.rejected", keys: rejected });
  }

  return { columns, extras: Object.fromEntries(extraEntries), rejected };
}
