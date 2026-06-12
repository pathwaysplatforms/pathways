'use server';

import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createRequestLogger } from '@/lib/logger';
import { redirect } from 'next/navigation';
import { z } from 'zod';

const ProfileUpdateSchema = z.object({
  full_name: z.string().min(1).max(200).optional(),
  nationality: z.string().max(100).optional(),
  current_country: z.string().max(100).optional(),
  occupation: z.string().max(200).optional(),
  years_experience: z.number().int().min(0).max(60).optional(),
  education_level_voice: z.string().max(100).optional(),
  degree_field: z.string().max(200).optional(),
  intended_province: z.string().max(100).optional(),
  income_currency: z.string().length(3).optional(),
});

export type ProfileUpdateFields = z.infer<typeof ProfileUpdateSchema>;

/** Updates mutable profile fields submitted from the Profile tab edit form. */
export async function updateProfileFields(fields: ProfileUpdateFields): Promise<void> {
  const supabase = createSupabaseServerClient() as unknown as SupabaseClient;
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  const logger = createRequestLogger(`profile-update-${user.id}`);
  logger.info({ action: 'updateProfileFields.start', userId: user.id });

  const parsed = ProfileUpdateSchema.safeParse(fields);
  if (!parsed.success) {
    logger.warn({ action: 'updateProfileFields.validation_failed', userId: user.id, errors: parsed.error.issues });
    return;
  }

  const updates = Object.fromEntries(
    Object.entries(parsed.data).filter(([, v]) => v !== undefined)
  );

  if (Object.keys(updates).length === 0) {
    logger.info({ action: 'updateProfileFields.no_changes', userId: user.id });
    return;
  }

  await supabase.from('profiles').update(updates).eq('auth_user_id', user.id);

  logger.info({ action: 'updateProfileFields.complete', userId: user.id });
}
