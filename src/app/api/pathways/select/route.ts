import { type NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { createRequestLogger } from '@/lib/logger';
import { requireAuth, getProfile } from '@/modules/auth/service';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { PathwaysError, AuthError, ValidationError, NotFoundError, DatabaseError } from '@/lib/errors';
import type { Logger } from 'pino';

const selectBodySchema = z.object({
  pathway_id: z.string().uuid('pathway_id must be a valid UUID'),
});

function handleError(error: unknown, log: Logger): Response {
  if (error instanceof PathwaysError) {
    log.error({ action: 'api.pathways.select.error', code: error.code, message: error.message });
    return Response.json(
      { error: { code: error.code, message: error.message } },
      { status: error.statusCode },
    );
  }
  log.error({ action: 'api.pathways.select.error', error: String(error) });
  return Response.json(
    { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' } },
    { status: 500 },
  );
}

/**
 * Creates a draft application for the selected pathway.
 * Body: { pathway_id: string }
 * Returns: { application_id: string }
 */
export async function POST(req: NextRequest): Promise<Response> {
  const correlationId = crypto.randomUUID();
  const log = createRequestLogger(correlationId);
  log.info({ action: 'api.pathways.select.start' });

  try {
    await requireAuth();

    const profile = await getProfile();
    if (!profile) throw new AuthError('Profile not found');

    // Validate body
    const raw = await req.json().catch(() => {
      throw new ValidationError('Request body must be valid JSON');
    });
    const parsed = selectBodySchema.safeParse(raw);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors[0]?.message ?? 'Invalid request body');
    }
    const { pathway_id } = parsed.data;

    const db = createSupabaseServerClient() as unknown as SupabaseClient;

    // Verify pathway exists and is active
    const { data: pathway, error: pwErr } = await db
      .from('pathways')
      .select('id, is_active')
      .eq('id', pathway_id)
      .single();

    if (pwErr || !pathway) throw new NotFoundError('Pathway not found');
    if (!pathway.is_active) throw new ValidationError('This pathway is no longer active');

    // Check no existing non-rejected application for this profile + pathway
    const { data: existing } = await db
      .from('applications')
      .select('id, status')
      .eq('profile_id', profile.id)
      .eq('pathway_id', pathway_id)
      .neq('status', 'rejected')
      .maybeSingle();

    if (existing) {
      return Response.json(
        { application_id: existing.id as string },
        { status: 200 },
      );
    }

    // Insert draft application
    const { data: newApp, error: insertErr } = await db
      .from('applications')
      .insert({ profile_id: profile.id, pathway_id, status: 'draft' })
      .select('id')
      .single();

    if (insertErr || !newApp) {
      throw new DatabaseError('Failed to create application', { pathway_id }, insertErr);
    }

    log.info({ action: 'api.pathways.select.done', applicationId: newApp.id });
    return Response.json({ application_id: newApp.id as string }, { status: 201 });
  } catch (error) {
    return handleError(error, log);
  }
}
