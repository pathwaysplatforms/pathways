'use server';

import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createRequestLogger } from '@/lib/logger';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { ValidationError, DatabaseError } from '@/lib/errors';

const slugSchema = z.string().min(1).max(200).regex(/^[a-z0-9-]+$/);

/** Persists the user's selected pathway slug to their profile row. */
export async function selectPathway(slug: string): Promise<void> {
  const parsed = slugSchema.safeParse(slug);
  if (!parsed.success) {
    throw new ValidationError('Invalid pathway slug');
  }

  const supabase = await createSupabaseServerClient() as unknown as SupabaseClient;
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  const logger = createRequestLogger(`select-pathway-${user.id}`);
  logger.info({ action: 'selectPathway.start', userId: user.id, slug: parsed.data });

  const { error } = await supabase
    .from('profiles')
    .update({ selected_pathway_slug: parsed.data })
    .eq('auth_user_id', user.id);

  if (error) {
    logger.error({ action: 'selectPathway.error', userId: user.id, error });
    throw new DatabaseError('Failed to save pathway selection', { userId: user.id }, error);
  }

  // Create a draft application row so /applications/[id] is reachable.
  const [{ data: profileRow }, { data: pathwayRow }] = await Promise.all([
    supabase.from('profiles').select('id').eq('auth_user_id', user.id).single(),
    supabase.from('pathways').select('id').eq('slug', parsed.data).eq('is_active', true).maybeSingle(),
  ]);

  const profileId = (profileRow as { id: string } | null)?.id;
  const pathwayId = (pathwayRow as { id: string } | null)?.id;

  if (profileId && pathwayId) {
    const { error: appErr } = await supabase
      .from('applications')
      .upsert(
        { profile_id: profileId, pathway_id: pathwayId, status: 'draft' },
        { onConflict: 'profile_id,pathway_id', ignoreDuplicates: true }
      );
    if (appErr) {
      logger.warn({ action: 'selectPathway.applicationUpsertFailed', userId: user.id, error: appErr });
    } else {
      logger.info({ action: 'selectPathway.applicationCreated', userId: user.id, pathwayId });
    }
  }

  logger.info({ action: 'selectPathway.complete', userId: user.id, slug: parsed.data });
  revalidatePath('/dashboard');
}
