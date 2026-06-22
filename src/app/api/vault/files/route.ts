import type { SupabaseClient } from '@supabase/supabase-js';
import { createRequestLogger } from '@/lib/logger';
import { requireAuth, getProfile } from '@/modules/auth/service';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { listVaultFiles } from '@/modules/vault/service';
import { PathwaysError } from '@/lib/errors';
import type { Logger } from 'pino';

function handleError(error: unknown, log: Logger): Response {
  if (error instanceof PathwaysError) {
    log.error({ action: 'api.vault.files.error', code: error.code, message: error.message });
    return Response.json(
      { error: { code: error.code, message: error.message } },
      { status: error.statusCode }
    );
  }
  log.error({ action: 'api.vault.files.error', error: String(error) });
  return Response.json(
    { error: { code: 'INTERNAL_ERROR', message: 'Failed to load files.' } },
    { status: 500 }
  );
}

/** List the authenticated user's vault files. */
export async function GET(): Promise<Response> {
  const correlationId = crypto.randomUUID();
  const log = createRequestLogger(correlationId);
  log.info({ action: 'api.vault.files.start' });

  try {
    await requireAuth();
    const profile = await getProfile();
    if (!profile) {
      return Response.json({ error: { code: 'AUTH_ERROR', message: 'Profile not found.' } }, { status: 401 });
    }

    const db = await createSupabaseServerClient() as unknown as SupabaseClient;
    const files = await listVaultFiles(profile.id, db, log);

    log.info({ action: 'api.vault.files.complete', count: files.length });
    return Response.json({ files });
  } catch (error) {
    return handleError(error, log);
  }
}
