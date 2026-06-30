'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { redirect } from 'next/navigation';
import { getProfile } from '@/modules/auth/service';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createRequestLogger } from '@/lib/logger';
import { AuthError, DatabaseError, ValidationError } from '@/lib/errors';
import type { SupabaseClient } from '@supabase/supabase-js';

const CompleteStepSchema = z.object({
  applicationId: z.string().uuid(),
  stepId: z.string().uuid(),
});

/** Marks a pathway step as completed for the current user's application. */
export async function completeStep(applicationId: string, stepId: string): Promise<void> {
  const correlationId = `complete-step-${Date.now()}`;
  const logger = createRequestLogger(correlationId);

  logger.info({ action: 'completeStep.start', applicationId, stepId });

  const parsed = CompleteStepSchema.safeParse({ applicationId, stepId });
  if (!parsed.success) {
    throw new ValidationError('Invalid applicationId or stepId', {
      issues: parsed.error.issues,
    });
  }

  const profile = await getProfile();
  if (!profile) {
    redirect('/auth/login');
  }

  // supabase types are stale pending `supabase gen types --local`
  const db = createSupabaseServerClient() as unknown as SupabaseClient;

  // Verify the application belongs to this profile before writing
  const { data: appRow, error: appErr } = await db
    .from('applications')
    .select('id')
    .eq('id', applicationId)
    .eq('profile_id', profile.id)
    .single();

  if (appErr || !appRow) {
    throw new AuthError('Application not found or access denied', { applicationId });
  }

  const { error } = await db
    .from('application_step_completions')
    .upsert(
      { application_id: applicationId, step_id: stepId },
      { onConflict: 'application_id,step_id', ignoreDuplicates: true },
    );

  if (error) {
    throw new DatabaseError('Failed to record step completion', { applicationId, stepId }, error);
  }

  logger.info({ action: 'completeStep.done', applicationId, stepId });

  revalidatePath(`/applications/${applicationId}`);
}
