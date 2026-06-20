import { type NextRequest } from 'next/server';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createRequestLogger } from '@/lib/logger';
import { requireAuth, getProfile } from '@/modules/auth/service';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { uploadVaultFile } from '@/modules/vault/service';
import { PathwaysError } from '@/lib/errors';
import type { Logger } from 'pino';

const UploadBodySchema = z.object({
  document_type: z.string().nullable().optional(),
});

function handleError(error: unknown, log: Logger): Response {
  if (error instanceof PathwaysError) {
    log.error({ action: 'api.vault.upload.error', code: error.code, message: error.message });
    return Response.json(
      { error: { code: error.code, message: error.message } },
      { status: error.statusCode }
    );
  }
  log.error({ action: 'api.vault.upload.error', error: String(error) });
  return Response.json(
    { error: { code: 'INTERNAL_ERROR', message: 'Upload failed.' } },
    { status: 500 }
  );
}

/** Upload a file to the user's document vault. */
export async function POST(req: NextRequest): Promise<Response> {
  const correlationId = crypto.randomUUID();
  const log = createRequestLogger(correlationId);
  log.info({ action: 'api.vault.upload.start' });

  try {
    await requireAuth();
    const profile = await getProfile();
    if (!profile) {
      return Response.json({ error: { code: 'AUTH_ERROR', message: 'Profile not found.' } }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file');
    const rawDocType = formData.get('document_type');

    if (!(file instanceof File)) {
      return Response.json(
        { error: { code: 'VALIDATION_ERROR', message: 'No file provided.' } },
        { status: 400 }
      );
    }

    const parsed = UploadBodySchema.safeParse({ document_type: rawDocType ?? undefined });
    if (!parsed.success) {
      return Response.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Invalid document_type.' } },
        { status: 400 }
      );
    }

    const documentType = parsed.data.document_type ?? null;
    const buffer = await file.arrayBuffer();

    const db = await createSupabaseServerClient() as unknown as SupabaseClient;
    const vaultFile = await uploadVaultFile(
      profile.id,
      { name: file.name, size: file.size, type: file.type, buffer },
      documentType,
      db,
      log
    );

    log.info({ action: 'api.vault.upload.complete', fileId: vaultFile.id });
    return Response.json({ file: vaultFile }, { status: 201 });
  } catch (error) {
    return handleError(error, log);
  }
}
