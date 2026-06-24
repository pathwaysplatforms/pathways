/**
 * Core pathway matching engine — 8-stage pipeline:
 *   A) Load and merge profile from DB
 *   B) Embed merged profile → OpenAI text-embedding-3-small
 *   C) Resolve target country from countries table
 *   D) Load candidate pathways from pathways table (country-filtered)
 *   E) Vector-search immigration_chunks once; group results by visa_type
 *   F) Hard eligibility pre-filter using pathways table thresholds
 *   G) Claude synthesis → top 3 PathwayRecommendation objects
 *   H) Persist result in pathway_matches; return PathwayMatchResult
 */

import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Logger } from "pino";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createLogger } from "@/lib/logger";
import { ValidationError, DatabaseError, InternalError } from "@/lib/errors";
import { embedProfile, profileToNLSummary } from "@/lib/embeddings";
import { computeCrsEstimate } from "@/lib/crs-estimate";
import { getVisaTypesForSlug } from "@/config/visa-type-mapping";
import type { VoiceExtractedProfile } from "@/modules/voice/types";
import type {
  PathwayMatchResult,
  PathwayRow,
  ImmigrationChunkRow,
  PathwayCandidate,
  EligibilityStatus,
} from "@/types/pathways";
import { PathwayMatchResultSchema } from "@/types/pathways";

// ─── Extended profile type ────────────────────────────────────────────────────

/** Profile row with all immigration-specific fields added by expand_profiles migrations. */
type MatcherProfile = {
  id: string;
  auth_user_id: string;
  full_name: string | null;
  nationality: string | null;
  current_country: string | null;
  occupation: string | null;
  years_experience: number | null;
  marital_status: string | null;
  onboarding_status: "not_started" | "voice_complete" | "complete";
  date_of_birth: string | null;
  annual_income: number | null;
  income_currency: string | null;
  intended_province: string | null;
  has_canadian_experience: boolean | null;
  language_proficiency_self: VoiceExtractedProfile["language_proficiency_self"];
  has_family_in_canada: boolean | null;
  education_level_voice: string | null;
  spouse_coming_to_canada: boolean | null;
  education_level: VoiceExtractedProfile["education_level"];
  eca_obtained: boolean | null;
  clb_speaking: number | null;
  clb_listening: number | null;
  clb_reading: number | null;
  clb_writing: number | null;
  canadian_work_years: number | null;
  foreign_work_years: number | null;
  foreign_work_recent: boolean | null;
  canadian_work_recent: boolean | null;
  noc_teer_category: number | null;
  noc_code: string | null;
  has_provincial_nomination: boolean | null;
  has_canadian_job_offer: boolean | null;
  has_sibling_in_canada: boolean | null;
  destination_country: string | null;
  spouse_education_level: VoiceExtractedProfile["spouse_education_level"];
  spouse_clb_speaking: number | null;
  spouse_clb_listening: number | null;
  spouse_clb_reading: number | null;
  spouse_clb_writing: number | null;
  spouse_canadian_work_years: number | null;
  voice_session_data: Record<string, unknown> | null;
};

// ─── Country resolution helpers ───────────────────────────────────────────────

const COUNTRY_NAME_TO_CODE: Record<string, string> = {
  canada: "CA",
  "united kingdom": "GB",
  uk: "GB",
  germany: "DE",
  australia: "AU",
  "united states": "US",
  usa: "US",
  portugal: "PT",
  netherlands: "NL",
  singapore: "SG",
};

/** Resolve a free-text destination country to a 2-letter ISO code. */
function resolveCountryCode(destinationCountry: string | null): string | null {
  if (!destinationCountry) return null;
  const lower = destinationCountry.toLowerCase().trim();
  return (
    COUNTRY_NAME_TO_CODE[lower] ??
    (destinationCountry.length === 2 ? destinationCountry.toUpperCase() : null)
  );
}

/**
 * Map an ISO code to the lowercase country name used in immigration_chunks.country.
 * Defaults to 'canada' since all current chunk data is Canadian.
 */
function isoToChunkCountry(isoCode: string): string {
  const map: Record<string, string> = {
    CA: "canada",
    GB: "united kingdom",
    DE: "germany",
    AU: "australia",
    US: "united states",
    PT: "portugal",
    NL: "netherlands",
  };
  return map[isoCode] ?? "canada";
}

/** Infer a PathwayType string from a pathway slug for use in Claude prompts. */
function inferPathwayType(slug: string): string {
  if (slug.includes("family")) return "family";
  if (
    slug.includes("bowp") ||
    slug.includes("pgwp") ||
    slug.includes("caregiver") ||
    slug.includes("work-permit")
  )
    return "work_permit";
  if (slug.includes("study") || slug.includes("student")) return "study";
  return "permanent_residency";
}

// ─── Profile adapter ──────────────────────────────────────────────────────────

function toVoiceProfile(p: MatcherProfile): Partial<VoiceExtractedProfile> {
  return {
    full_name: p.full_name,
    date_of_birth: p.date_of_birth,
    nationality: p.nationality,
    current_country: p.current_country,
    marital_status: p.marital_status,
    education_level_voice: p.education_level_voice,
    years_experience: p.years_experience,
    has_canadian_experience: p.has_canadian_experience,
    occupation: p.occupation,
    language_proficiency_self: p.language_proficiency_self,
    has_family_in_canada: p.has_family_in_canada,
    intended_province: p.intended_province,
    annual_income: p.annual_income,
    income_currency: p.income_currency,
    clb_speaking: p.clb_speaking ?? undefined,
    clb_listening: p.clb_listening ?? undefined,
    clb_reading: p.clb_reading ?? undefined,
    clb_writing: p.clb_writing ?? undefined,
    canadian_work_years: p.canadian_work_years ?? undefined,
    foreign_work_years: p.foreign_work_years ?? undefined,
    canadian_work_recent: p.canadian_work_recent ?? undefined,
    foreign_work_recent: p.foreign_work_recent ?? undefined,
    noc_teer_category: p.noc_teer_category ?? undefined,
    noc_code: p.noc_code ?? undefined,
    education_level: p.education_level ?? undefined,
    eca_obtained: p.eca_obtained ?? undefined,
    spouse_coming_to_canada: p.spouse_coming_to_canada ?? undefined,
    spouse_education_level: p.spouse_education_level ?? undefined,
    spouse_clb_speaking: p.spouse_clb_speaking ?? undefined,
    spouse_clb_listening: p.spouse_clb_listening ?? undefined,
    spouse_clb_reading: p.spouse_clb_reading ?? undefined,
    spouse_clb_writing: p.spouse_clb_writing ?? undefined,
    spouse_canadian_work_years: p.spouse_canadian_work_years ?? undefined,
    has_provincial_nomination: p.has_provincial_nomination ?? undefined,
    has_canadian_job_offer: p.has_canadian_job_offer ?? undefined,
    has_sibling_in_canada: p.has_sibling_in_canada ?? undefined,
    destination_country: p.destination_country ?? undefined,
    requires_review: [],
  };
}

// ─── Hard eligibility pre-filter ─────────────────────────────────────────────

const POST_SECONDARY = new Set([
  "bachelors",
  "masters",
  "phd",
  "two_or_more_credentials",
  "two_year_post_secondary",
  "one_year_post_secondary",
]);

/** Apply hard threshold checks from pathways table columns. Returns INELIGIBLE only on clear failures. */
function checkEligibility(
  pathway: PathwayRow,
  profile: Partial<VoiceExtractedProfile>
): EligibilityStatus {
  // Degree check — only eliminate if we know education level and it's below post-secondary
  if (pathway.requires_degree) {
    if (profile.education_level != null && !POST_SECONDARY.has(profile.education_level)) {
      return "INELIGIBLE";
    }
  }

  // Experience check — only eliminate if we have experience data and it's below minimum
  if (pathway.min_years_experience > 0) {
    const foreignYrs = profile.foreign_work_years ?? null;
    const canadianYrs = profile.canadian_work_years ?? null;
    if (foreignYrs !== null || canadianYrs !== null) {
      const totalExp = (foreignYrs ?? 0) + (canadianYrs ?? 0);
      if (totalExp < pathway.min_years_experience) return "INELIGIBLE";
    }
  }

  // CLB check — read dedicated columns first, fall back to additional_rules
  const clbMin =
    pathway.min_clb_listening ??
    (pathway.additional_rules?.clb_min as Record<string, number> | undefined)
      ?.listening ??
    null;
  if (clbMin !== null) {
    const { clb_listening: l, clb_reading: r, clb_writing: w, clb_speaking: s } = profile;
    // Only eliminate if all four CLB scores are present and the weakest is below minimum
    if (l != null && r != null && w != null && s != null) {
      if (Math.min(l, r, w, s) < clbMin) return "INELIGIBLE";
    }
  }

  // Canadian experience — only eliminate if we know they have none
  if (pathway.requires_canadian_experience === true) {
    if (profile.canadian_work_years != null && profile.canadian_work_years <= 0) {
      return "INELIGIBLE";
    }
  }

  // CRS gate — eliminate if even the optimistic CRS estimate is below the pathway's typical minimum
  if (pathway.typical_crs_min !== null) {
    const crs = computeCrsEstimate(profile);
    if (crs && crs.high < pathway.typical_crs_min) return "INELIGIBLE";
  }

  // ECA — downgrade to LIKELY rather than eliminate (user can still obtain one)
  if (pathway.requires_eca === true && profile.eca_obtained === false) return "LIKELY";

  return "ELIGIBLE";
}

// ─── Claude client ────────────────────────────────────────────────────────────

function getAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new InternalError("ANTHROPIC_API_KEY is not set");
  return new Anthropic({ apiKey });
}

// ─── Claude synthesis prompt ──────────────────────────────────────────────────

const CLAUDE_SYSTEM = `You are an expert immigration advisor helping a user understand their best immigration pathways. You have been given the user's profile and retrieved documentation about specific immigration programs.

Your task: Select the 3 best-matching pathways from the candidates provided and for each one:
1. Assign a match_score (0–100) based on how well the user qualifies
2. Write why_it_fits: 2–3 sentences specific to THIS user's profile — reference their actual CLB scores, NOC code, education, experience years
3. List key_requirements: 3–5 most important requirements as brief bullet strings
4. Write gap_analysis: if the user has any notable gaps or risks for this pathway, be honest. If they are a strong match, set to null.
5. Provide estimated_timeline as a string (e.g. "6–12 months")
6. Set match_label: "Excellent match" (score 80+), "Good match" (60–79), "Possible match" (<60)

Also write a summary: a single friendly paragraph (3–4 sentences) addressing the user directly, explaining what their strongest options are and why, in plain language.

Rules:
- Never fabricate specific fees or processing times — use ranges from the documentation
- If you are uncertain about a requirement, say so in gap_analysis
- Reference the user's actual profile data (CLB scores, NOC, etc.) — do not be generic
- Rank pathways by: (1) likelihood of success, (2) speed, (3) quality of life outcome
- For country_name use the full English country name (e.g. "Canada", "United Kingdom", "Germany")
- For flag_emoji use the correct country flag emoji
- For source_url use the most relevant URL from the retrieved chunks
- Respond ONLY with valid JSON — no preamble, no markdown fences, no trailing text
- Respond with ONLY a raw JSON object. No markdown, no code fences, no preamble, no explanation. The very first character of your response must be { and the very last must be }`;

function buildClaudeUserMessage(
  nlSummary: string,
  profileJson: Partial<VoiceExtractedProfile>,
  candidates: PathwayCandidate[],
  validSlugs: string[]
): string {
  const parts: string[] = [
    "USER PROFILE (natural language):",
    nlSummary,
    "",
    "PROFILE DATA (structured):",
    JSON.stringify(
      {
        nationality: profileJson.nationality,
        date_of_birth: profileJson.date_of_birth,
        occupation: profileJson.occupation,
        noc_code: profileJson.noc_code,
        noc_teer_category: profileJson.noc_teer_category,
        education_level: profileJson.education_level,
        eca_obtained: profileJson.eca_obtained,
        clb_speaking: profileJson.clb_speaking,
        clb_listening: profileJson.clb_listening,
        clb_reading: profileJson.clb_reading,
        clb_writing: profileJson.clb_writing,
        language_proficiency_self: profileJson.language_proficiency_self,
        canadian_work_years: profileJson.canadian_work_years,
        foreign_work_years: profileJson.foreign_work_years,
        has_provincial_nomination: profileJson.has_provincial_nomination,
        has_canadian_job_offer: profileJson.has_canadian_job_offer,
        has_sibling_in_canada: profileJson.has_sibling_in_canada,
        spouse_coming_to_canada: profileJson.spouse_coming_to_canada,
        annual_income: profileJson.annual_income,
        income_currency: profileJson.income_currency,
        intended_province: profileJson.intended_province,
        destination_country: profileJson.destination_country,
      },
      null,
      2
    ),
    "",
    "PATHWAY CANDIDATES (with eligibility assessment and supporting IRCC documentation):",
  ];

  for (const c of candidates) {
    parts.push(
      `\n--- ${c.pathway_name} (${c.pathway_id}) ---`,
      `Country: ${c.country_code} | Type: ${c.pathway_type} | Eligibility: ${c.eligibility}`,
      `Description: ${c.description}`,
      `Source: ${c.source_url ?? "N/A"}`,
      "IRCC documentation excerpts:"
    );
    if (c.top_chunks.length === 0) {
      parts.push("[No specific documentation retrieved — use general knowledge for this pathway]");
    } else {
      c.top_chunks.forEach((chunk, i) => {
        parts.push(`[Chunk ${i + 1}] ${chunk}`);
      });
    }
  }

  parts.push(
    "",
    `Return exactly 3 pathways. Each pathway_id must be one of: ${validSlugs.join(", ")}`,
    "",
    "Return the top 3 pathways as JSON matching this exact schema:",
    JSON.stringify(
      {
        user_id: "uuid string",
        matched_at: "ISO 8601 string",
        top_pathways: [
          {
            pathway_id: "string",
            pathway_name: "string",
            country_code: "ISO 2-letter string",
            country_name: "full country name",
            flag_emoji: "flag emoji",
            pathway_type:
              "permanent_residency | work_permit | study | citizenship | family",
            match_score: "number 0-100",
            match_label: "Excellent match | Good match | Possible match",
            why_it_fits: "2-3 sentences specific to this user",
            key_requirements: ["bullet 1", "bullet 2", "bullet 3"],
            gap_analysis: "string or null",
            estimated_timeline: "e.g. 6-12 months",
            source_url: "string",
            retrieved_chunks: ["chunk text 1", "chunk text 2"],
          },
        ],
        summary: "1 paragraph addressing the user directly",
      },
      null,
      2
    )
  );

  return parts.join("\n");
}

// ─── JSON extraction helper ───────────────────────────────────────────────────

/** Strip markdown code fences and extraneous text Claude sometimes wraps around JSON. */
function extractJSON(raw: string): string {
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();
  const jsonMatch = raw.match(/(\{[\s\S]*\})/);
  if (jsonMatch) return jsonMatch[1].trim();
  return raw.trim();
}

// ─── Main export ──────────────────────────────────────────────────────────────

/** Run the 8-stage pathway matching pipeline for a given profiles.id. */
export async function matchPathways(
  userId: string,
  log?: Logger
): Promise<PathwayMatchResult> {
  const logger = log ?? createLogger();
  logger.info({ action: "pathway_matcher.start", userId });

  const adminDb = createSupabaseAdminClient() as unknown as SupabaseClient;

  // ── Step A: Load and merge profile ────────────────────────────────────────
  const { data: profileData, error: profileError } = await adminDb
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (profileError || !profileData) {
    throw new DatabaseError(
      "Failed to load profile",
      { userId },
      profileError ?? undefined
    );
  }

  const profile = profileData as MatcherProfile;

  if (profile.onboarding_status !== "complete") {
    throw new ValidationError(
      "Onboarding must be complete before pathway matching can run",
      { onboarding_status: profile.onboarding_status }
    );
  }

  // voice_session_data is the authoritative source — flat columns may be null
  // when the confirm step did not write them.
  const voiceData = (profile.voice_session_data ?? {}) as Partial<MatcherProfile>;
  const mergedProfile: MatcherProfile = {
    ...profile,
    clb_listening: voiceData.clb_listening ?? profile.clb_listening,
    clb_reading: voiceData.clb_reading ?? profile.clb_reading,
    clb_speaking: voiceData.clb_speaking ?? profile.clb_speaking,
    clb_writing: voiceData.clb_writing ?? profile.clb_writing,
    noc_code: voiceData.noc_code ?? profile.noc_code,
    noc_teer_category: voiceData.noc_teer_category ?? profile.noc_teer_category,
    education_level: voiceData.education_level ?? profile.education_level,
    education_level_voice:
      voiceData.education_level_voice ?? profile.education_level_voice,
    eca_obtained: voiceData.eca_obtained ?? profile.eca_obtained,
    foreign_work_years:
      voiceData.foreign_work_years ?? profile.foreign_work_years,
    foreign_work_recent:
      voiceData.foreign_work_recent ?? profile.foreign_work_recent,
    canadian_work_years:
      voiceData.canadian_work_years ?? profile.canadian_work_years,
    canadian_work_recent:
      voiceData.canadian_work_recent ?? profile.canadian_work_recent,
    occupation: voiceData.occupation ?? profile.occupation,
    nationality: voiceData.nationality ?? profile.nationality,
    current_country: voiceData.current_country ?? profile.current_country,
    date_of_birth: voiceData.date_of_birth ?? profile.date_of_birth,
    marital_status: voiceData.marital_status ?? profile.marital_status,
    years_experience: voiceData.years_experience ?? profile.years_experience,
    has_canadian_experience:
      voiceData.has_canadian_experience ?? profile.has_canadian_experience,
    language_proficiency_self:
      voiceData.language_proficiency_self ?? profile.language_proficiency_self,
    has_family_in_canada:
      voiceData.has_family_in_canada ?? profile.has_family_in_canada,
    intended_province: voiceData.intended_province ?? profile.intended_province,
    annual_income: voiceData.annual_income ?? profile.annual_income,
    income_currency: voiceData.income_currency ?? profile.income_currency,
    spouse_coming_to_canada:
      voiceData.spouse_coming_to_canada ?? profile.spouse_coming_to_canada,
    spouse_education_level:
      voiceData.spouse_education_level ?? profile.spouse_education_level,
    spouse_clb_speaking:
      voiceData.spouse_clb_speaking ?? profile.spouse_clb_speaking,
    spouse_clb_listening:
      voiceData.spouse_clb_listening ?? profile.spouse_clb_listening,
    spouse_clb_reading:
      voiceData.spouse_clb_reading ?? profile.spouse_clb_reading,
    spouse_clb_writing:
      voiceData.spouse_clb_writing ?? profile.spouse_clb_writing,
    spouse_canadian_work_years:
      voiceData.spouse_canadian_work_years ?? profile.spouse_canadian_work_years,
    has_provincial_nomination:
      voiceData.has_provincial_nomination ?? profile.has_provincial_nomination,
    has_canadian_job_offer:
      voiceData.has_canadian_job_offer ?? profile.has_canadian_job_offer,
    has_sibling_in_canada:
      voiceData.has_sibling_in_canada ?? profile.has_sibling_in_canada,
    destination_country:
      voiceData.destination_country ?? profile.destination_country,
  };

  // ── Step B: Profile → NL summary + embedding ─────────────────────────────
  const voiceProfile = toVoiceProfile(mergedProfile);
  const nlSummary = profileToNLSummary(voiceProfile);

  logger.info({ action: "pathway_matcher.embedding_start" });
  let queryEmbedding: number[];
  try {
    queryEmbedding = await embedProfile(voiceProfile);
  } catch (err) {
    const cause = err as { status?: number; message?: string; error?: { message?: string } };
    logger.error({
      action: "pathway_matcher.embedding_failed",
      status: cause?.status,
      message: cause?.message ?? String(err),
      detail: cause?.error?.message,
    });
    throw new InternalError("Failed to generate profile embedding", undefined, err);
  }
  logger.info({ action: "pathway_matcher.embedding_done" });

  // ── Step C: Resolve target country from countries table ───────────────────
  const isoCode =
    resolveCountryCode(mergedProfile.destination_country ?? null) ?? "CA";
  logger.info({ action: "pathway_matcher.country_filter", isoCode });

  const { data: countryData, error: countryError } = await adminDb
    .from("countries")
    .select("id, name, iso_code")
    .eq("iso_code", isoCode)
    .single();

  if (countryError || !countryData) {
    throw new DatabaseError(
      "Failed to resolve destination country",
      { isoCode },
      countryError ?? undefined
    );
  }

  const country = countryData as { id: string; name: string; iso_code: string };

  // ── Step D: Load candidate pathways from pathways table ───────────────────
  const { data: pathwayRows, error: pathwaysError } = await adminDb
    .from("pathways")
    .select(
      `id, country_id, category_id, slug, title, official_name, description,
       requires_degree, min_years_experience, english_min_score,
       requires_english_test, additional_rules, is_active,
       min_clb_speaking, min_clb_listening, min_clb_reading, min_clb_writing,
       requires_eca, typical_crs_min, typical_crs_max,
       requires_canadian_experience, requires_proof_of_funds,
       processing_time_min, processing_time_max, program_type,
       pathway_categories(name, slug)`
    )
    .eq("country_id", country.id)
    .eq("is_active", true);

  if (pathwaysError) {
    throw new DatabaseError("Failed to load pathways", undefined, pathwaysError);
  }

  const pathways = (pathwayRows ?? []) as PathwayRow[];
  logger.info({ action: "pathway_matcher.pathways_loaded", count: pathways.length });

  if (pathways.length === 0) {
    throw new ValidationError(
      `No active pathways found for country ${country.name}. Check the pathways table.`
    );
  }

  const validSlugs = pathways.map((p) => p.slug);

  // ── Step E: Fetch immigration_chunks via vector search (one call) ─────────
  const vectorParam = `[${queryEmbedding.join(",")}]`;
  const chunkCountry = isoToChunkCountry(country.iso_code);

  const { data: rawChunks, error: chunksError } = await adminDb.rpc(
    "match_immigration_chunks",
    {
      query_embedding: vectorParam,
      match_threshold: 0.1,
      match_count: 200,
      filter_country: chunkCountry,
    }
  );

  if (chunksError) {
    throw new DatabaseError("immigration_chunks vector search failed", undefined, chunksError);
  }

  const allChunks = (rawChunks ?? []) as ImmigrationChunkRow[];
  logger.info({
    action: "pathway_matcher.chunks_retrieved",
    count: allChunks.length,
    country: chunkCountry,
  });

  // Group chunks by visa_type for fast per-pathway lookup
  const chunksByVisaType = new Map<string, ImmigrationChunkRow[]>();
  for (const chunk of allChunks) {
    const existing = chunksByVisaType.get(chunk.visa_type);
    if (existing) {
      existing.push(chunk);
    } else {
      chunksByVisaType.set(chunk.visa_type, [chunk]);
    }
  }

  // ── Step F: Hard eligibility filter → build PathwayCandidate list ─────────
  const FALLBACK_VISA_TYPES = ["general", "permanent_residence", "express_entry"];
  const candidates: PathwayCandidate[] = [];

  for (const pathway of pathways) {
    const eligibility = checkEligibility(pathway, voiceProfile);
    if (eligibility === "INELIGIBLE") {
      logger.info({
        action: "pathway_matcher.eliminated",
        slug: pathway.slug,
        eligibility,
      });
      continue;
    }

    // Gather relevant chunks from immigration_chunks for this pathway
    const visaTypes = getVisaTypesForSlug(pathway.slug);
    const effectiveVisaTypes =
      visaTypes.length > 0 ? visaTypes : FALLBACK_VISA_TYPES;

    const pathwayChunks: ImmigrationChunkRow[] = [];
    for (const vt of effectiveVisaTypes) {
      const vtChunks = chunksByVisaType.get(vt) ?? [];
      for (const chunk of vtChunks) {
        if (!pathwayChunks.some((c) => c.id === chunk.id)) {
          pathwayChunks.push(chunk);
        }
      }
    }
    // Already ordered by similarity from the RPC; keep top 8
    const topChunks = pathwayChunks.slice(0, 8);

    const sourceUrl =
      topChunks.find((c) => c.source_url)?.source_url ?? null;

    candidates.push({
      pathway_id: pathway.slug,
      pathway_name: pathway.title,
      country_code: country.iso_code,
      pathway_type: pathway.program_type ?? inferPathwayType(pathway.slug),
      description: pathway.description,
      source_url: sourceUrl,
      eligibility,
      top_chunks: topChunks.map((c) => c.chunk_text),
    });
  }

  logger.info({ action: "pathway_matcher.candidates", count: candidates.length });

  if (candidates.length < 1) {
    throw new ValidationError(
      "No eligible pathways found for this profile. Update your profile details and try again."
    );
  }

  // ── Step G: Claude synthesis ──────────────────────────────────────────────
  const anthropic = getAnthropicClient();
  const userMessage = buildClaudeUserMessage(nlSummary, voiceProfile, candidates, validSlugs);

  const validSlugConstraint = `\n\nCRITICAL CONSTRAINT: You may ONLY recommend pathways from this exact list of valid pathway IDs. Do not invent, modify, or combine pathway IDs.\nValid pathway IDs: ${validSlugs.join(", ")}\nEach pathway_id in your response must exactly match one of the above slugs. If a pathway you want to recommend is not in this list, do not include it.`;
  const systemWithConstraint = CLAUDE_SYSTEM + validSlugConstraint;

  logger.info({ action: "pathway_matcher.claude_start" });

  let claudeResponse: string;
  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: systemWithConstraint,
      messages: [{ role: "user", content: userMessage }],
    });
    const block = message.content[0];
    if (block.type !== "text") {
      throw new InternalError("Claude returned non-text content block");
    }
    claudeResponse = block.text;
  } catch (err) {
    if (err instanceof InternalError) throw err;
    throw new InternalError("Claude API call failed", undefined, err);
  }

  logger.info({ action: "pathway_matcher.claude_done" });

  let parsedResult: unknown;
  try {
    const cleaned = extractJSON(claudeResponse);
    parsedResult = JSON.parse(cleaned);
  } catch (err) {
    logger.error({
      action: "pathway_matcher.json_parse_failed",
      rawResponse: claudeResponse.slice(0, 500),
      error: err instanceof Error ? err.message : String(err),
    });
    throw new InternalError(
      "Claude returned invalid JSON",
      { raw: claudeResponse.slice(0, 500) },
      err
    );
  }

  const now = new Date().toISOString();
  const resultWithMeta = {
    ...(parsedResult as Record<string, unknown>),
    user_id: userId,
    matched_at: now,
  };

  const validated = PathwayMatchResultSchema.safeParse(resultWithMeta);
  if (!validated.success) {
    throw new InternalError("Claude response failed schema validation", {
      errors: validated.error.errors.map(
        (e) => `${e.path.join(".")}: ${e.message}`
      ),
      raw: claudeResponse.slice(0, 500),
    });
  }

  const result = validated.data;

  // Validate that all returned pathway_ids are real DB slugs
  const invalidSlugs = result.top_pathways
    .filter((p) => !validSlugs.includes(p.pathway_id))
    .map((p) => p.pathway_id);

  if (invalidSlugs.length > 0) {
    logger.error({
      action: "pathway_matcher.invalid_slugs",
      invalidSlugs,
      validSlugs,
    });
    result.top_pathways = result.top_pathways.filter((p) =>
      validSlugs.includes(p.pathway_id)
    );
  }

  if (result.top_pathways.length < 3) {
    logger.warn({
      action: "pathway_matcher.insufficient_pathways",
      count: result.top_pathways.length,
    });
  }

  // ── Step H: Persist and return ────────────────────────────────────────────
  const profileSnapshot = {
    nationality: mergedProfile.nationality,
    education_level: mergedProfile.education_level,
    clb_speaking: mergedProfile.clb_speaking,
    clb_listening: mergedProfile.clb_listening,
    clb_reading: mergedProfile.clb_reading,
    clb_writing: mergedProfile.clb_writing,
    canadian_work_years: mergedProfile.canadian_work_years,
    foreign_work_years: mergedProfile.foreign_work_years,
    noc_teer_category: mergedProfile.noc_teer_category,
    has_provincial_nomination: mergedProfile.has_provincial_nomination,
    destination_country: mergedProfile.destination_country,
  };

  const { error: insertError } = await adminDb.from("pathway_matches").insert({
    user_id: userId,
    top_pathways: result.top_pathways,
    summary: result.summary,
    profile_snapshot: profileSnapshot,
  });

  if (insertError) {
    logger.error({
      action: "pathway_matcher.persist_error",
      error: insertError.message,
    });
  }

  logger.info({ action: "pathway_matcher.done", userId });
  return result;
}

/** Return the most recent cached PathwayMatchResult for a user, or null. */
export async function getCachedMatch(
  userId: string
): Promise<PathwayMatchResult | null> {
  const adminDb = createSupabaseAdminClient() as unknown as SupabaseClient;

  const { data, error } = await adminDb
    .from("pathway_matches")
    .select("*")
    .eq("user_id", userId)
    .order("matched_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;

  const row = data as {
    user_id: string;
    matched_at: string;
    top_pathways: unknown;
    summary: string;
  };

  const validated = PathwayMatchResultSchema.safeParse({
    user_id: row.user_id,
    matched_at: row.matched_at,
    top_pathways: row.top_pathways,
    summary: row.summary ?? "",
  });

  return validated.success ? validated.data : null;
}

/**
 * Run the pathway matching pipeline for a guest (unauthenticated) user.
 * Accepts a VoiceExtractedProfile directly instead of loading from DB.
 * Does not persist results — caller is responsible for saving to guest_sessions.
 * @param guestId  UUID to use as user_id in the result (typically the session token).
 */
export async function matchPathwaysForGuest(
  guestProfile: Partial<VoiceExtractedProfile>,
  guestId: string,
  log?: Logger
): Promise<PathwayMatchResult> {
  const logger = log ?? createLogger();
  logger.info({ action: "pathway_matcher.guest.start" });

  const adminDb = createSupabaseAdminClient() as unknown as SupabaseClient;

  // ── Step B: Profile → NL summary + embedding ──────────────────────────────
  const nlSummary = profileToNLSummary(guestProfile);
  let queryEmbedding: number[];
  try {
    queryEmbedding = await embedProfile(guestProfile);
  } catch (err) {
    throw new InternalError("Failed to generate profile embedding for guest", undefined, err);
  }

  // ── Step C: Resolve target country ────────────────────────────────────────
  const isoCode = resolveCountryCode(guestProfile.destination_country ?? null) ?? "CA";

  const { data: countryData, error: countryError } = await adminDb
    .from("countries")
    .select("id, name, iso_code")
    .eq("iso_code", isoCode)
    .single();

  if (countryError || !countryData) {
    throw new DatabaseError("Failed to resolve destination country for guest", { isoCode }, countryError ?? undefined);
  }

  const country = countryData as { id: string; name: string; iso_code: string };

  // ── Step D: Load candidate pathways ───────────────────────────────────────
  const { data: pathwayRows, error: pathwaysError } = await adminDb
    .from("pathways")
    .select(
      `id, country_id, category_id, slug, title, official_name, description,
       requires_degree, min_years_experience, english_min_score,
       requires_english_test, additional_rules, is_active,
       min_clb_speaking, min_clb_listening, min_clb_reading, min_clb_writing,
       requires_eca, typical_crs_min, typical_crs_max,
       requires_canadian_experience, requires_proof_of_funds,
       processing_time_min, processing_time_max, program_type,
       pathway_categories(name, slug)`
    )
    .eq("country_id", country.id)
    .eq("is_active", true);

  if (pathwaysError) {
    throw new DatabaseError("Failed to load pathways for guest", undefined, pathwaysError);
  }

  const pathways = (pathwayRows ?? []) as PathwayRow[];
  if (pathways.length === 0) {
    throw new ValidationError(`No active pathways found for country ${country.name}.`);
  }

  const validSlugs = pathways.map((p) => p.slug);

  // ── Step E: Vector search ─────────────────────────────────────────────────
  const vectorParam = `[${queryEmbedding.join(",")}]`;
  const chunkCountry = isoToChunkCountry(country.iso_code);

  const { data: rawChunks, error: chunksError } = await adminDb.rpc(
    "match_immigration_chunks",
    { query_embedding: vectorParam, match_threshold: 0.1, match_count: 200, filter_country: chunkCountry }
  );

  if (chunksError) {
    throw new DatabaseError("immigration_chunks vector search failed for guest", undefined, chunksError);
  }

  const allChunks = (rawChunks ?? []) as ImmigrationChunkRow[];

  const chunksByVisaType = new Map<string, ImmigrationChunkRow[]>();
  for (const chunk of allChunks) {
    const existing = chunksByVisaType.get(chunk.visa_type);
    if (existing) { existing.push(chunk); } else { chunksByVisaType.set(chunk.visa_type, [chunk]); }
  }

  // ── Step F: Hard eligibility filter ───────────────────────────────────────
  const FALLBACK_VISA_TYPES = ["general", "permanent_residence", "express_entry"];
  const candidates: PathwayCandidate[] = [];

  for (const pathway of pathways) {
    const eligibility = checkEligibility(pathway, guestProfile);
    if (eligibility === "INELIGIBLE") continue;

    const visaTypes = getVisaTypesForSlug(pathway.slug);
    const effectiveVisaTypes = visaTypes.length > 0 ? visaTypes : FALLBACK_VISA_TYPES;
    const pathwayChunks: ImmigrationChunkRow[] = [];
    for (const vt of effectiveVisaTypes) {
      for (const chunk of chunksByVisaType.get(vt) ?? []) {
        if (!pathwayChunks.some((c) => c.id === chunk.id)) pathwayChunks.push(chunk);
      }
    }

    candidates.push({
      pathway_id: pathway.slug,
      pathway_name: pathway.title,
      country_code: country.iso_code,
      pathway_type: pathway.program_type ?? inferPathwayType(pathway.slug),
      description: pathway.description,
      source_url: pathwayChunks.find((c) => c.source_url)?.source_url ?? null,
      eligibility,
      top_chunks: pathwayChunks.slice(0, 8).map((c) => c.chunk_text),
    });
  }

  if (candidates.length < 1) {
    throw new ValidationError("No eligible pathways found for this profile.");
  }

  // ── Step G: Claude synthesis ───────────────────────────────────────────────
  const anthropic = getAnthropicClient();
  const userMessage = buildClaudeUserMessage(nlSummary, guestProfile, candidates, validSlugs);
  const validSlugConstraint = `\n\nCRITICAL CONSTRAINT: You may ONLY recommend pathways from this exact list of valid pathway IDs.\nValid pathway IDs: ${validSlugs.join(", ")}\nEach pathway_id in your response must exactly match one of the above slugs.`;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: CLAUDE_SYSTEM + validSlugConstraint,
    messages: [{ role: "user", content: userMessage }],
  });

  const block = message.content[0];
  if (!block || block.type !== "text") throw new InternalError("Claude returned non-text content block");

  let parsedResult: unknown;
  try {
    parsedResult = JSON.parse(extractJSON(block.text));
  } catch (err) {
    throw new InternalError("Claude returned invalid JSON for guest match", { raw: block.text.slice(0, 500) }, err);
  }

  const resultWithMeta = {
    ...(parsedResult as Record<string, unknown>),
    user_id: guestId,
    matched_at: new Date().toISOString(),
  };

  const validated = PathwayMatchResultSchema.safeParse(resultWithMeta);
  if (!validated.success) {
    throw new InternalError("Claude response failed schema validation for guest", {
      errors: validated.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`),
    });
  }

  const result = validated.data;
  result.top_pathways = result.top_pathways.filter((p) => validSlugs.includes(p.pathway_id));

  logger.info({ action: "pathway_matcher.guest.done", count: result.top_pathways.length });
  return result;
}
