import type { SupabaseClient } from "@supabase/supabase-js";
import type { Logger } from "pino";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { VoiceExtractedProfile } from "@/modules/voice/types";
import { computeCrsEstimate } from "@/lib/crs-estimate";

/**
 * Write pathway_input_json to the profiles table to feed the async matching engine.
 * Fire-and-forget safe — logs errors but never throws.
 */
export async function triggerPathwayRecognition(
  profileId: string,
  profile: VoiceExtractedProfile,
  log: Logger,
): Promise<void> {
  const estimate = computeCrsEstimate(profile);

  const pathwayInput = {
    nationality: profile.nationality,
    destination_country: profile.destination_country ?? "Canada",
    purpose: profile.purpose ?? null,
    date_of_birth: profile.date_of_birth ?? null,
    marital_status: profile.marital_status ?? null,
    dependents: profile.dependents ?? 0,
    clb_speaking: profile.clb_speaking ?? null,
    clb_listening: profile.clb_listening ?? null,
    clb_reading: profile.clb_reading ?? null,
    clb_writing: profile.clb_writing ?? null,
    occupation: profile.occupation ?? null,
    noc_teer_category: profile.noc_teer_category ?? null,
    canadian_work_years: profile.canadian_work_years ?? 0,
    foreign_work_years: profile.foreign_work_years ?? 0,
    canadian_work_recent: profile.canadian_work_recent ?? false,
    foreign_work_recent: profile.foreign_work_recent ?? false,
    education_level: profile.education_level ?? null,
    eca_obtained: profile.eca_obtained ?? null,
    has_provincial_nomination: profile.has_provincial_nomination ?? false,
    has_canadian_job_offer: profile.has_canadian_job_offer ?? false,
    has_sibling_in_canada: profile.has_sibling_in_canada ?? false,
    spouse_coming_to_canada: profile.spouse_coming_to_canada ?? false,
    spouse_education_level: profile.spouse_education_level ?? null,
    spouse_canadian_work_years: profile.spouse_canadian_work_years ?? 0,
    crs_estimate: estimate?.score ?? null,
    crs_estimate_low: estimate?.low ?? null,
    crs_estimate_high: estimate?.high ?? null,
  };

  const supabase = createSupabaseAdminClient() as unknown as SupabaseClient;
  const { error } = await supabase
    .from("profiles")
    .update({ pathway_input_json: pathwayInput })
    .eq("id", profileId);

  if (error) {
    log.error({ error, profileId }, "pathway-recognition: failed to write pathway_input_json");
    return;
  }

  log.info({ profileId, crsEstimate: estimate?.score }, "pathway-recognition: triggered");
}
