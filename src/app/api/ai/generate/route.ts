/**
 * POST /api/ai/generate
 * Generates an AI draft (email, letter, cover letter) for a checklist subtask.
 * Returns { output: string }.
 */

import type { NextRequest } from 'next/server';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createRequestLogger } from '@/lib/logger';
import { requireAuth } from '@/modules/auth/service';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { enforceRateLimit, rateLimitHeaders } from '@/lib/rate-limit';
import { generateAiDraft, type AiProfileContext } from '@/modules/ai/service';
import { AuthError, PathwaysError } from '@/lib/errors';

const bodySchema = z.object({
  action_type: z.enum([
    'employer_reference_email',
    'eca_inquiry_email',
    'eca_status_email',
    'language_score_email',
    'bank_letter_request_email',
    'cover_letter',
    'employer_support_email',
    'pnp_inquiry_email',
    'trade_cert_inquiry_email',
    'transcript_request_email',
    'designated_org_inquiry_email',
    'commitment_letter_follow_up',
    'community_recommendation_request',
    'sponsorship_support_letter',
    'endorsement_inquiry_email',
  ]),
  step_id: z.string().uuid(),
});

export const runtime = 'nodejs';

/** POST /api/ai/generate */
export async function POST(req: NextRequest): Promise<Response> {
  const correlationId = crypto.randomUUID();
  const log = createRequestLogger(correlationId);
  log.info({ action: 'api.ai.generate.start' });

  let user;
  try {
    user = await requireAuth();
  } catch (err) {
    if (err instanceof AuthError) {
      return Response.json(
        { error: { code: 'UNAUTHORIZED', message: 'Sign in to use AI generation.' } },
        { status: 401 },
      );
    }
    throw err;
  }

  const rl = await enforceRateLimit(`ai-generate:${user.id}`, { limit: 20, windowMs: 60_000 });
  if (!rl.success) {
    log.warn({ action: 'api.ai.generate.rate_limited', userId: user.id });
    return Response.json(
      { error: { code: 'RATE_LIMITED', message: 'Too many requests. Please slow down.' } },
      { status: 429, headers: rateLimitHeaders(rl) },
    );
  }

  const body = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: { code: 'VALIDATION_ERROR', message: 'action_type and step_id (UUID) are required.' } },
      { status: 400 },
    );
  }

  const { action_type, step_id } = parsed.data;

  try {
    const db = await createSupabaseServerClient() as unknown as SupabaseClient;

    const { data: profileData, error: profileError } = await db
      .from('profiles')
      .select(
        'full_name,nationality,occupation,years_experience,education_level,degree_level,degree_field,' +
        'noc_code,clb_speaking,clb_listening,clb_reading,clb_writing,intended_province,has_canadian_job_offer',
      )
      .eq('auth_user_id', user.id)
      .single();

    if (profileError || !profileData) {
      return Response.json({ error: { code: 'NOT_FOUND', message: 'Profile not found.' } }, { status: 404 });
    }

    const p = profileData as unknown as Record<string, unknown>;

    const profile: AiProfileContext = {
      fullName: (p.full_name as string | null) ?? null,
      nationality: (p.nationality as string | null) ?? null,
      occupation: (p.occupation as string | null) ?? null,
      yearsExperience: (p.years_experience as number | null) ?? null,
      educationLevel: (p.education_level as string | null) ?? (p.degree_level as string | null) ?? null,
      degreeField: (p.degree_field as string | null) ?? null,
      nocCode: (p.noc_code as string | null) ?? null,
      clbSpeaking: (p.clb_speaking as number | null) ?? null,
      clbListening: (p.clb_listening as number | null) ?? null,
      clbReading: (p.clb_reading as number | null) ?? null,
      clbWriting: (p.clb_writing as number | null) ?? null,
      intendedProvince: (p.intended_province as string | null) ?? null,
      hasCanadianJobOffer: (p.has_canadian_job_offer as boolean | null) ?? null,
    };

    // Fetch pathway title via the step
    const stepResult = await db
      .from('pathway_steps')
      .select('pathway_id')
      .eq('id', step_id)
      .single();
    const stepData = stepResult.data as { pathway_id: string } | null;

    let pathwayTitle = 'Canadian immigration pathway';
    if (stepData?.pathway_id) {
      const pathwayResult = await db
        .from('pathways')
        .select('title')
        .eq('id', stepData.pathway_id)
        .single();
      const pathwayData = pathwayResult.data as { title: string } | null;
      if (pathwayData?.title) pathwayTitle = pathwayData.title;
    }

    log.info({ action: 'api.ai.generate.calling', userId: user.id, action_type });
    const output = await generateAiDraft(action_type, profile, pathwayTitle);
    log.info({ action: 'api.ai.generate.complete', userId: user.id, action_type });

    return Response.json({ output });
  } catch (err) {
    if (err instanceof PathwaysError) {
      log.error({ action: 'api.ai.generate.error', code: err.code, message: err.message });
      return Response.json({ error: { code: err.code, message: err.message } }, { status: err.statusCode });
    }
    log.error({ action: 'api.ai.generate.unexpected', err: String(err) });
    return Response.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to generate draft.' } },
      { status: 500 },
    );
  }
}
