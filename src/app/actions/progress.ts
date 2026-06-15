'use server';

import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createRequestLogger } from '@/lib/logger';
import { revalidatePath } from 'next/cache';
import { AuthError, DatabaseError, ValidationError } from '@/lib/errors';

const schema = z.object({
  stepId: z.string().uuid(),
  pathwaySlug: z.string().min(1).max(200),
  status: z.enum(['upcoming', 'current', 'complete']),
});

/** Persists a single step's progress status to pathway_progress via upsert. */
export async function updateStepProgress(input: {
  stepId: string;
  pathwaySlug: string;
  status: 'upcoming' | 'current' | 'complete';
}): Promise<void> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError('Invalid progress input', { issues: parsed.error.issues });
  }

  const supabase = createSupabaseServerClient() as unknown as SupabaseClient;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new AuthError('Not authenticated');

  const correlationId = `update-progress-${user.id}-${Date.now()}`;
  const logger = createRequestLogger(correlationId);
  logger.info({ action: 'updateStepProgress.start', userId: user.id, stepId: parsed.data.stepId, status: parsed.data.status });

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('auth_user_id', user.id)
    .single();

  if (profileError || !profile) {
    throw new DatabaseError('Profile not found', { userId: user.id }, profileError ?? undefined);
  }

  const profileRow = profile as { id: string };

  const { error } = await supabase
    .from('pathway_progress')
    .upsert(
      {
        profile_id: profileRow.id,
        pathway_slug: parsed.data.pathwaySlug,
        step_id: parsed.data.stepId,
        status: parsed.data.status,
        completed_at: parsed.data.status === 'complete' ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'profile_id,step_id' }
    );

  if (error) {
    logger.error({ action: 'updateStepProgress.error', userId: user.id, error });
    throw new DatabaseError('Failed to update progress', { userId: user.id }, error);
  }

  logger.info({ action: 'updateStepProgress.complete', userId: user.id, stepId: parsed.data.stepId, status: parsed.data.status });
  revalidatePath('/dashboard');
  revalidatePath('/application');
  revalidatePath('/dashboard/application');
}
