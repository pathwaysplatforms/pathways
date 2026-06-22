import type { SupabaseClient } from '@supabase/supabase-js';
import type { Logger } from 'pino';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { DatabaseError, NotFoundError, ValidationError } from '@/lib/errors';
import type { VaultFile } from './types';
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES, MAX_FILES_PER_USER } from './types';

const BUCKET = 'user-documents';

interface UserDocRow {
  id: string;
  user_id: string;
  storage_path: string;
  file_name: string;
  display_name: string | null;
  file_size: number;
  mime_type: string;
  document_type: string | null;
  uploaded_at: string;
}

const FULL_SELECT = 'id, user_id, storage_path, file_name, display_name, file_size, mime_type, document_type, uploaded_at';

function mapRow(row: UserDocRow): VaultFile {
  return {
    id: row.id,
    userId: row.user_id,
    storagePath: row.storage_path,
    fileName: row.file_name,
    displayName: row.display_name,
    fileSize: row.file_size,
    mimeType: row.mime_type,
    documentType: row.document_type,
    uploadedAt: row.uploaded_at,
  };
}

/** Lists all vault files for a profile, ordered by upload date descending. */
export async function listVaultFiles(
  profileId: string,
  db: SupabaseClient,
  logger: Logger
): Promise<VaultFile[]> {
  logger.info({ action: 'vault.listVaultFiles.start', profileId });

  const { data, error } = await db
    .from('user_documents')
    .select(FULL_SELECT)
    .eq('user_id', profileId)
    .order('uploaded_at', { ascending: false });

  if (error) throw new DatabaseError('Failed to list vault files', { profileId }, error);

  logger.info({ action: 'vault.listVaultFiles.complete', profileId, count: data?.length ?? 0 });
  return ((data ?? []) as UserDocRow[]).map(mapRow);
}

/** Uploads a file to Storage and inserts a user_documents row. Returns the new VaultFile. */
export async function uploadVaultFile(
  profileId: string,
  file: { name: string; size: number; type: string; buffer: ArrayBuffer },
  documentType: string | null,
  db: SupabaseClient,
  logger: Logger
): Promise<VaultFile> {
  logger.info({ action: 'vault.uploadVaultFile.start', profileId, fileName: file.name, size: file.size });

  if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(file.type)) {
    throw new ValidationError('File type not allowed. Use PDF, JPEG, or PNG.', { mimeType: file.type });
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new ValidationError('File exceeds 10 MB limit.', { fileSize: file.size });
  }

  const { count, error: countError } = await db
    .from('user_documents')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', profileId);

  if (countError) throw new DatabaseError('Failed to count vault files', { profileId }, countError);

  if ((count ?? 0) >= MAX_FILES_PER_USER) {
    throw new ValidationError(
      `Vault limit reached. Maximum ${MAX_FILES_PER_USER} files allowed.`,
      { count }
    );
  }

  const fileId = crypto.randomUUID();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);
  const storagePath = `${profileId}/${fileId}-${safeName}`;

  const admin = createSupabaseAdminClient();
  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(storagePath, file.buffer, { contentType: file.type, upsert: false });

  if (uploadError) {
    throw new DatabaseError('Storage upload failed', { profileId, storagePath }, uploadError);
  }

  const { data: inserted, error: insertError } = await db
    .from('user_documents')
    .insert({
      user_id: profileId,
      storage_path: storagePath,
      file_name: file.name,
      file_size: file.size,
      mime_type: file.type,
      document_type: documentType ?? null,
    })
    .select(FULL_SELECT)
    .single();

  if (insertError) {
    await admin.storage.from(BUCKET).remove([storagePath]);
    throw new DatabaseError('Failed to record vault file', { profileId, storagePath }, insertError);
  }

  logger.info({ action: 'vault.uploadVaultFile.complete', profileId, fileId });
  return mapRow(inserted as UserDocRow);
}

/** Updates the document_type label on an existing vault file. Null clears the label. */
export async function updateVaultFileType(
  fileId: string,
  profileId: string,
  documentType: string | null,
  db: SupabaseClient,
  logger: Logger
): Promise<VaultFile> {
  logger.info({ action: 'vault.updateVaultFileType.start', fileId, profileId });

  const { data, error } = await db
    .from('user_documents')
    .update({ document_type: documentType })
    .eq('id', fileId)
    .eq('user_id', profileId)
    .select(FULL_SELECT)
    .single();

  if (error) {
    if ((error as { code?: string }).code === 'PGRST116') {
      throw new NotFoundError('Vault file not found', { fileId, profileId });
    }
    throw new DatabaseError('Failed to update vault file type', { fileId, profileId }, error);
  }

  logger.info({ action: 'vault.updateVaultFileType.complete', fileId });
  return mapRow(data as UserDocRow);
}

/** Updates the display_name on an existing vault file. Null resets to file_name fallback. */
export async function updateVaultDisplayName(
  fileId: string,
  profileId: string,
  displayName: string | null,
  db: SupabaseClient,
  logger: Logger
): Promise<VaultFile> {
  logger.info({ action: 'vault.updateVaultDisplayName.start', fileId, profileId });

  const { data, error } = await db
    .from('user_documents')
    .update({ display_name: displayName })
    .eq('id', fileId)
    .eq('user_id', profileId)
    .select(FULL_SELECT)
    .single();

  if (error) {
    if ((error as { code?: string }).code === 'PGRST116') {
      throw new NotFoundError('Vault file not found', { fileId, profileId });
    }
    throw new DatabaseError('Failed to update vault file name', { fileId, profileId }, error);
  }

  logger.info({ action: 'vault.updateVaultDisplayName.complete', fileId });
  return mapRow(data as UserDocRow);
}

/** Deletes a vault file from Storage and removes its user_documents row. */
export async function deleteVaultFile(
  fileId: string,
  profileId: string,
  db: SupabaseClient,
  logger: Logger
): Promise<void> {
  logger.info({ action: 'vault.deleteVaultFile.start', fileId, profileId });

  const { data, error } = await db
    .from('user_documents')
    .select('storage_path')
    .eq('id', fileId)
    .eq('user_id', profileId)
    .single();

  if (error) {
    if ((error as { code?: string }).code === 'PGRST116') {
      throw new NotFoundError('Vault file not found', { fileId, profileId });
    }
    throw new DatabaseError('Failed to fetch vault file for deletion', { fileId, profileId }, error);
  }

  const { storage_path } = data as { storage_path: string };

  const admin = createSupabaseAdminClient();
  const { error: storageError } = await admin.storage.from(BUCKET).remove([storage_path]);
  if (storageError) {
    logger.warn({ action: 'vault.deleteVaultFile.storageWarn', fileId, error: storageError });
  }

  const { error: dbError } = await db
    .from('user_documents')
    .delete()
    .eq('id', fileId)
    .eq('user_id', profileId);

  if (dbError) throw new DatabaseError('Failed to delete vault file record', { fileId, profileId }, dbError);

  logger.info({ action: 'vault.deleteVaultFile.complete', fileId });
}

/** Returns a 1-hour signed URL for a Storage object. */
export async function getVaultSignedUrl(storagePath: string, logger: Logger): Promise<string> {
  logger.info({ action: 'vault.getSignedUrl.start', storagePath });

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.storage.from(BUCKET).createSignedUrl(storagePath, 3600);

  if (error || !data?.signedUrl) {
    throw new DatabaseError('Failed to create signed URL', { storagePath }, error ?? undefined);
  }

  logger.info({ action: 'vault.getSignedUrl.complete', storagePath });
  return data.signedUrl;
}

/** Returns the set of document_type values the user has labeled files with (for satisfaction checks). */
export async function getSatisfiedDocTypes(
  profileId: string,
  db: SupabaseClient,
  logger: Logger
): Promise<Set<string>> {
  logger.info({ action: 'vault.getSatisfiedDocTypes.start', profileId });

  const { data, error } = await db
    .from('user_documents')
    .select('document_type')
    .eq('user_id', profileId)
    .not('document_type', 'is', null);

  if (error) throw new DatabaseError('Failed to fetch satisfied doc types', { profileId }, error);

  const types = new Set<string>(
    ((data ?? []) as { document_type: string }[]).map((r) => r.document_type)
  );

  logger.info({ action: 'vault.getSatisfiedDocTypes.complete', profileId, count: types.size });
  return types;
}
