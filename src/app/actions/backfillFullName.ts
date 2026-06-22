'use server';

import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createRequestLogger } from '@/lib/logger';
import { DatabaseError } from '@/lib/errors';

/**
 * One-shot backfill: copies full_name from voice_session_data into profiles.full_name
 * for every profile where full_name is NULL but voice_session_data exists.
 * Safe to call repeatedly — only updates rows that still need it.
 */
export async function backfillFullName(): Promise<{ updated: number; skipped: number }> {
  const log = createRequestLogger('backfill-full-name');
  log.info({ action: 'backfillFullName.start' });

  const adminDb = createSupabaseAdminClient() as unknown as SupabaseClient;

  const { data: rows, error: fetchError } = await adminDb
    .from('profiles')
    .select('id, voice_session_data')
    .is('full_name', null)
    .not('voice_session_data', 'is', null);

  if (fetchError) {
    throw new DatabaseError('backfillFullName: failed to fetch profiles', {}, fetchError);
  }

  const candidates = (rows ?? []) as { id: string; voice_session_data: unknown }[];

  let updated = 0;
  let skipped = 0;

  for (const row of candidates) {
    const vsd = row.voice_session_data as Record<string, unknown> | null;
    const extractedName =
      typeof vsd?.full_name === 'string' && vsd.full_name.trim().length > 0
        ? vsd.full_name.trim()
        : null;

    if (!extractedName) {
      skipped++;
      continue;
    }

    const { error: updateError } = await adminDb
      .from('profiles')
      .update({ full_name: extractedName })
      .eq('id', row.id);

    if (updateError) {
      log.error({ action: 'backfillFullName.row.error', profileId: row.id, error: updateError });
      skipped++;
      continue;
    }

    log.info({ action: 'backfillFullName.row.updated', profileId: row.id, extractedName });
    updated++;
  }

  log.info({ action: 'backfillFullName.complete', updated, skipped, total: candidates.length });
  return { updated, skipped };
}
