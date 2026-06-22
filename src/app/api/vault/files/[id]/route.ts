import { type NextRequest } from 'next/server';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createRequestLogger } from '@/lib/logger';
import { requireAuth, getProfile } from '@/modules/auth/service';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { updateVaultFileType, updateVaultDisplayName, deleteVaultFile } from '@/modules/vault/service';
import { PathwaysError } from '@/lib/errors';
import type { Logger } from 'pino';

import type { VaultFile } from '@/modules/vault/types';

const UpdateFileSchema = z.object({
  document_type: z.string().nullable().optional(),
  display_name: z.string().max(255).nullable().optional(),
});

function handleError(error: unknown, log: Logger): Response {
  if (error instanceof PathwaysError) {
    log.error({ action: 'api.vault.file.error', code: error.code, message: error.message });
    return Response.json(
      { error: { code: error.code, message: error.message } },
      { status: error.statusCode }
    );
  }
  log.error({ action: 'api.vault.file.error', error: String(error) });
  return Response.json(
    { error: { code: 'INTERNAL_ERROR', message: 'Operation failed.' } },
    { status: 500 }
  );
}

/** Update document_type and/or display_name on a vault file. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const correlationId = crypto.randomUUID();
  const log = createRequestLogger(correlationId);
  const { id: fileId } = await params;
  log.info({ action: 'api.vault.file.patch.start', fileId });

  try {
    await requireAuth();
    const profile = await getProfile();
    if (!profile) {
      return Response.json({ error: { code: 'AUTH_ERROR', message: 'Profile not found.' } }, { status: 401 });
    }

    const body: unknown = await req.json();
    const parsed = UpdateFileSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Invalid request body.' } },
        { status: 400 }
      );
    }

    const { document_type, display_name } = parsed.data;
    if (document_type === undefined && display_name === undefined) {
      return Response.json(
        { error: { code: 'VALIDATION_ERROR', message: 'No fields to update.' } },
        { status: 400 }
      );
    }

    const db = await createSupabaseServerClient() as unknown as SupabaseClient;
    let updated: VaultFile | undefined;

    if (document_type !== undefined) {
      updated = await updateVaultFileType(fileId, profile.id, document_type, db, log);
    }
    if (display_name !== undefined) {
      updated = await updateVaultDisplayName(fileId, profile.id, display_name, db, log);
    }

    log.info({ action: 'api.vault.file.patch.complete', fileId });
    return Response.json({ file: updated });
  } catch (error) {
    return handleError(error, log);
  }
}

/** Delete a vault file from Storage and the database. */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const correlationId = crypto.randomUUID();
  const log = createRequestLogger(correlationId);
  const { id: fileId } = await params;
  log.info({ action: 'api.vault.file.delete.start', fileId });

  try {
    await requireAuth();
    const profile = await getProfile();
    if (!profile) {
      return Response.json({ error: { code: 'AUTH_ERROR', message: 'Profile not found.' } }, { status: 401 });
    }

    const db = await createSupabaseServerClient() as unknown as SupabaseClient;
    await deleteVaultFile(fileId, profile.id, db, log);

    log.info({ action: 'api.vault.file.delete.complete', fileId });
    return new Response(null, { status: 204 });
  } catch (error) {
    return handleError(error, log);
  }
}
