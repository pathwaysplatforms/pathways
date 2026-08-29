'use server';

import { revalidatePath } from 'next/cache';
import { requireAuth } from '@/modules/auth/service';
import { createRequestLogger } from '@/lib/logger';
import { createCoApplicantProfile } from '@/modules/co-applicant/service';
import type { CreateCoApplicantInput } from '@/modules/co-applicant/types';

/** Creates a co-applicant profile owned by the current user's account. */
export async function addCoApplicant(
  input: CreateCoApplicantInput,
): Promise<{ id: string; fullName: string | null }> {
  const correlationId = `add-co-applicant-${Date.now()}`;
  const logger = createRequestLogger(correlationId);
  logger.info({ action: 'addCoApplicant.start' });

  const user = await requireAuth();

  const coApplicant = await createCoApplicantProfile(user.id, input, logger);

  logger.info({ action: 'addCoApplicant.done', coApplicantProfileId: coApplicant.id });

  revalidatePath('/dashboard/application');

  return { id: coApplicant.id, fullName: coApplicant.full_name };
}
