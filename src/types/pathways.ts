/**
 * Types for the pathway matching engine.
 * Audit notes:
 *   - No existing pathway matching types found in codebase
 *   - pathway_documents and pathway_matches tables created in migration 20260530000001
 *   - CRS estimation exists in src/lib/crs-estimate.ts (reused in eligibility gating)
 *   - Embeddings use OpenAI text-embedding-3-small (1536 dims) via OPENAI_API_KEY
 */

import { z } from "zod";

export const PathwayTypeSchema = z.enum([
  "permanent_residency",
  "work_permit",
  "study",
  "citizenship",
  "family",
]);
export type PathwayType = z.infer<typeof PathwayTypeSchema>;

export const MatchLabelSchema = z.enum([
  "Excellent match",
  "Good match",
  "Possible match",
]);
export type MatchLabel = z.infer<typeof MatchLabelSchema>;

export const PathwayRecommendationSchema = z.object({
  pathway_id: z.string(),
  pathway_name: z.string(),
  country_code: z.string(),
  country_name: z.string(),
  flag_emoji: z.string(),
  pathway_type: PathwayTypeSchema,
  match_score: z.number().min(0).max(100),
  match_label: MatchLabelSchema,
  why_it_fits: z.string(),
  key_requirements: z.array(z.string()).min(1).max(8),
  gap_analysis: z.string().nullable(),
  estimated_timeline: z.string(),
  source_url: z.string(),
  retrieved_chunks: z.array(z.string()),
});
export type PathwayRecommendation = z.infer<typeof PathwayRecommendationSchema>;

export const PathwayMatchResultSchema = z.object({
  user_id: z.string().uuid(),
  matched_at: z.string(),
  top_pathways: z.array(PathwayRecommendationSchema).min(1).max(3),
  summary: z.string(),
});
export type PathwayMatchResult = z.infer<typeof PathwayMatchResultSchema>;

/** Raw row returned by the match_pathway_documents RPC. */
export interface PathwayDocumentRow {
  id: string;
  pathway_id: string;
  pathway_name: string;
  country_code: string;
  pathway_type: string;
  chunk_text: string;
  source_url: string | null;
  metadata: Record<string, unknown>;
  similarity: number;
}

/** Row shape returned by a pathways table select (with pathway_categories join). */
export interface PathwayRow {
  id: string;
  country_id: string;
  category_id: string;
  title: string;
  slug: string;
  official_name: string;
  description: string;
  processing_time_min: string;
  processing_time_max: string;
  requires_degree: boolean;
  min_years_experience: number;
  requires_english_test: boolean;
  english_min_score: string | null;
  additional_rules: Record<string, unknown> | null;
  is_active: boolean;
  program_type: string | null;
  min_clb_speaking: number | null;
  min_clb_listening: number | null;
  min_clb_reading: number | null;
  min_clb_writing: number | null;
  requires_canadian_experience: boolean | null;
  requires_eca: boolean | null;
  requires_proof_of_funds: boolean | null;
  typical_crs_min: number | null;
  typical_crs_max: number | null;
  pathway_categories: { name: string; slug: string }[] | null;
}

/** Raw row returned by the match_immigration_chunks RPC. */
export interface ImmigrationChunkRow {
  id: string;
  chunk_text: string;
  country: string;
  visa_type: string;
  source_url: string | null;
  similarity: number;
}

/** Eligibility status after hard-threshold pre-filter. */
export type EligibilityStatus = "ELIGIBLE" | "LIKELY" | "INELIGIBLE";

export interface PathwayCandidate {
  pathway_id: string;
  pathway_name: string;
  country_code: string;
  pathway_type: string;
  description: string;
  source_url: string | null;
  eligibility: EligibilityStatus;
  top_chunks: string[];
}
