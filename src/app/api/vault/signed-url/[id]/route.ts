import { type NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createRequestLogger } from '@/lib/logger';
import { requireAuth, getProfile } from '@/modules/auth/service';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getVaultSignedUrl } from '@/modules/vault/service';
import { PathwaysError } from '@/lib/errors';
import type { Logger } from 'pino';

function handleError(error: unknown, log: Logger): Response {
  if (error instanceof PathwaysError) {
    log.error({ action: 'api.vault.signedUrl.error', code: error.code, message: error.message });
    return Response.json(
      { error: { code: error.code, message: error.message } },
      { status: error.statusCode }
    );
  }
  log.error({ action: 'api.vault.signedUrl.error', error: String(error) });
  return Response.json(
    { error: { code: 'INTERNAL_ERROR', message: 'Failed to generate link.' } },
    { status: 500 }
  );
}

/** Get a 1-hour signed download URL for a vault file. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const correlationId = crypto.randomUUID();
  const log = createRequestLogger(correlationId);
  const { id: fileId } = await params;
  log.info({ action: 'api.vault.signedUrl.start', fileId });

  try {
    await requireAuth();
    const profile = await getProfile();
    if (!profile) {
      return Response.json({ error: { code: 'AUTH_ERROR', message: 'Profile not found.' } }, { status: 401 });
    }

    // Verify the file belongs to this user before generating a URL
    const db = await createSupabaseServerClient() as unknown as SupabaseClient;
    const { data, error } = await db
      .from('user_documents')
      .select('storage_path')
      .eq('id', fileId)
      .eq('user_id', profile.id)
      .single();

    if (error || !data) {
      return Response.json({ error: { code: 'NOT_FOUND', message: 'File not found.' } }, { status: 404 });
    }

    const { storage_path } = data as { storage_path: string };
    const signedUrl = await getVaultSignedUrl(storage_path, log);

    log.info({ action: 'api.vault.signedUrl.complete', fileId });
    return Response.json({ url: signedUrl });
  } catch (error) {
    return handleError(error, log);
  }
}
