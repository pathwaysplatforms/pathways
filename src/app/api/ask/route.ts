/**
 * POST /api/ask — RAG-backed immigration Q&A using immigration_chunks + Claude Haiku.
 * Session-only conversation: no persistence, no new tables.
 */

import type { NextRequest } from 'next/server';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { createRequestLogger } from '@/lib/logger';
import { requireAuth } from '@/modules/auth/service';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { embedText, profileToNLSummary } from '@/lib/embeddings';
import type { VoiceExtractedProfile } from '@/modules/voice/types';
import { getVisaTypesForSlug } from '@/config/visa-type-mapping';
import { PathwaysError } from '@/lib/errors';
import type { ImmigrationChunkRow } from '@/types/pathways';

const bodySchema = z.object({
  question: z.string().min(1).max(2000),
  conversationHistory: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string(),
      })
    )
    .max(50),
});

const SYSTEM_PROMPT =
  'You are an immigration guidance assistant for Pathways, helping users navigate their Canadian immigration application. You answer questions based strictly on the official IRCC documentation provided to you as context. Rules: (1) Only answer from the provided context chunks — if the answer is not in the context, say so clearly and suggest the user check the official IRCC website or consult a licensed immigration consultant. (2) Always cite your sources by referencing the source URL at the end of your answer in the format: \'Source: [url]\'. If multiple chunks were used, list all URLs. (3) Use plain language — no jargon without explanation. (4) Never guarantee outcomes, processing times, or application results. (5) Keep answers concise — 150 words maximum unless the question genuinely requires more detail. (6) This is general information, not legal advice. (7) Do not include raw URLs inline in your answer text. URLs belong only in the Sources section which is handled separately. If you want to reference a source, say \'according to IRCC\' or \'per official guidelines\' rather than pasting a URL.';

const FALLBACK_VISA_TYPES = ['general', 'permanent_residence', 'express_entry'];

function getAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set');
  return new Anthropic({ apiKey });
}

/** POST /api/ask */
export async function POST(req: NextRequest): Promise<Response> {
  const correlationId = crypto.randomUUID();
  const log = createRequestLogger(correlationId);
  log.info({ action: 'api.ask.start' });

  try {
    const user = await requireAuth();
    const db = createSupabaseServerClient() as unknown as SupabaseClient;

    const rawBody = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return Response.json(
        { error: { code: 'VALIDATION_ERROR', message: 'question (string) and conversationHistory (array) are required.' } },
        { status: 400 }
      );
    }

    const { question, conversationHistory } = parsed.data;

    // Load full profile — needed for pathway slug, visa_type resolution, and profile summary
    const { data: profileData, error: profileError } = await db
      .from('profiles')
      .select('*')
      .eq('auth_user_id', user.id)
      .single();

    if (profileError || !profileData) {
      log.error({ action: 'api.ask.profile_not_found', userId: user.id });
      return Response.json(
        { error: { code: 'NOT_FOUND', message: 'Profile not found.' } },
        { status: 404 }
      );
    }

    const rawProfile = profileData as Record<string, unknown>;
    const profile = {
      id: rawProfile.id as string,
      selected_pathway_slug: (rawProfile.selected_pathway_slug as string | null) ?? null,
    };

    // Merge voice_session_data on top so profileToNLSummary sees the freshest values
    const voiceSessionData =
      (rawProfile.voice_session_data as Record<string, unknown> | null) ?? {};
    const mergedForSummary = {
      ...rawProfile,
      ...voiceSessionData,
    } as unknown as Partial<VoiceExtractedProfile>;

    // Generate the profile summary; degrade gracefully on failure
    let profileSummary: string | null = null;
    try {
      profileSummary = profileToNLSummary(mergedForSummary);
      log.debug({
        action: 'api.ask.profile_summary_tokens',
        tokens: Math.ceil(profileSummary.length / 4),
      });
    } catch (err) {
      log.warn({ action: 'api.ask.profile_summary_failed', error: String(err) });
    }

    // Resolve pathway slug: profile field first, then active application
    let pathwaySlug: string | null = profile.selected_pathway_slug;

    if (!pathwaySlug) {
      const { data: appData } = await db
        .from('applications')
        .select('pathway:pathways(slug)')
        .eq('profile_id', profile.id)
        .maybeSingle();

      if (appData) {
        const app = appData as unknown as { pathway: { slug: string } | null };
        pathwaySlug = app.pathway?.slug ?? null;
      }
    }

    // Derive relevant visa_types for client-side chunk filtering
    const visaTypes = pathwaySlug ? getVisaTypesForSlug(pathwaySlug) : [];
    const effectiveVisaTypes = visaTypes.length > 0 ? visaTypes : FALLBACK_VISA_TYPES;

    log.info({ action: 'api.ask.pathway_resolved', pathwaySlug, effectiveVisaTypes });

    // Embed the question
    let questionEmbedding: number[];
    try {
      questionEmbedding = await embedText(question);
    } catch (err) {
      log.error({ action: 'api.ask.embed_failed', error: String(err) });
      return Response.json(
        { error: { code: 'INTERNAL_ERROR', message: 'Failed to process your question. Please try again.' } },
        { status: 500 }
      );
    }

    // Query immigration_chunks via RPC — no visa_type filter in RPC, filter client-side
    const vectorParam = `[${questionEmbedding.join(',')}]`;
    const { data: rawChunks, error: chunksError } = await db.rpc('match_immigration_chunks', {
      query_embedding: vectorParam,
      match_threshold: 0.1,
      match_count: 50,
      filter_country: 'canada',
    });

    if (chunksError) {
      log.error({ action: 'api.ask.chunks_failed', error: chunksError.message });
      return Response.json(
        { error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve documentation. Please try again.' } },
        { status: 500 }
      );
    }

    const allChunks = (rawChunks ?? []) as ImmigrationChunkRow[];

    // Filter by visa_type, take top 5; fall back to unfiltered top 5 if no matches
    const filtered = allChunks.filter((c) => effectiveVisaTypes.includes(c.visa_type));
    const chunks = (filtered.length > 0 ? filtered : allChunks).slice(0, 5);

    log.info({ action: 'api.ask.chunks_retrieved', total: allChunks.length, used: chunks.length });

    // Build messages: last 6 from history + new user message with chunk context injected
    const trimmedHistory = conversationHistory.slice(-6);
    const chunkContext = chunks
      .map((c, i) => `[${i + 1}] ${c.chunk_text.slice(0, 800)}\nSource: ${c.source_url ?? 'N/A'}`)
      .join('\n\n');

    const userMessageContent = `[Relevant documentation]:\n\n${chunkContext}\n\n${question}`;

    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
      ...trimmedHistory,
      { role: 'user', content: userMessageContent },
    ];

    // Build personalised system prompt — append profile block when available
    const systemPrompt = profileSummary
      ? `${SYSTEM_PROMPT}\n\nUser profile:\n${profileSummary}\n\nUse this profile to personalise your answers. When the user asks about eligibility, timelines, or requirements, tailor your response to their specific situation rather than giving generic information. If their profile suggests they may not meet a requirement, say so directly but constructively.`
      : SYSTEM_PROMPT;

    // Call Claude Haiku
    const anthropic = getAnthropicClient();
    let claudeText: string;
    try {
      const claudeResponse = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        system: systemPrompt,
        messages,
      });

      const block = claudeResponse.content[0];
      if (block.type !== 'text') {
        throw new Error(`Unexpected content block type: ${block.type}`);
      }
      claudeText = block.text;
    } catch (err) {
      log.error({ action: 'api.ask.claude_failed', error: String(err) });
      return Response.json(
        { error: { code: 'INTERNAL_ERROR', message: 'Failed to generate an answer. Please try again.' } },
        { status: 500 }
      );
    }

    const sources = [
      ...new Set(chunks.map((c) => c.source_url).filter((u): u is string => u !== null)),
    ];

    log.info({ action: 'api.ask.complete', userId: user.id, sourceCount: sources.length });

    return Response.json({ answer: claudeText, sources }, { status: 200 });
  } catch (err) {
    if (err instanceof PathwaysError) {
      log.error({ action: 'api.ask.error', code: err.code, message: err.message });
      return Response.json(
        { error: { code: err.code, message: err.message } },
        { status: err.statusCode }
      );
    }
    log.error({ action: 'api.ask.error', error: String(err) });
    return Response.json(
      { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' } },
      { status: 500 }
    );
  }
}
