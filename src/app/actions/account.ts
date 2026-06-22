'use server';

import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createRequestLogger } from '@/lib/logger';
import { AuthError, DatabaseError, ValidationError } from '@/lib/errors';
import { buildUserExport } from '@/modules/account/service';
import type { UserExportData } from '@/modules/account/types';

const EmailSchema = z.string().email().max(320);

/** Sends a magic-link re-verification to the new email address. */
export async function changeEmail(
  newEmail: string
): Promise<{ error?: string }> {
  const parsed = EmailSchema.safeParse(newEmail);
  if (!parsed.success) {
    return { error: 'Invalid email address.' };
  }

  const supabase = await createSupabaseServerClient() as unknown as SupabaseClient;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new AuthError('Not authenticated');

  const correlationId = `change-email-${user.id}-${Date.now()}`;
  const logger = createRequestLogger(correlationId);
  logger.info({ action: 'changeEmail.start', userId: user.id });

  const { error } = await supabase.auth.updateUser({ email: parsed.data });
  if (error) {
    logger.error({ action: 'changeEmail.error', userId: user.id, error });
    return { error: 'Failed to send verification email. Please try again.' };
  }

  logger.info({ action: 'changeEmail.complete', userId: user.id });
  return {};
}

/** Invalidates all active sessions across all devices. */
export async function signOutEverywhere(): Promise<never> {
  const supabase = await createSupabaseServerClient() as unknown as SupabaseClient;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new AuthError('Not authenticated');

  const correlationId = `sign-out-everywhere-${user.id}-${Date.now()}`;
  const logger = createRequestLogger(correlationId);
  logger.info({ action: 'signOutEverywhere.start', userId: user.id });

  await supabase.auth.signOut({ scope: 'global' });

  logger.info({ action: 'signOutEverywhere.complete', userId: user.id });
  redirect('/auth/login');
}

/** Compiles all user-owned data into a downloadable JSON export. */
export async function exportUserData(): Promise<UserExportData> {
  const supabase = await createSupabaseServerClient() as unknown as SupabaseClient;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new AuthError('Not authenticated');

  const correlationId = `export-data-${user.id}-${Date.now()}`;
  const logger = createRequestLogger(correlationId);
  logger.info({ action: 'exportUserData.start', userId: user.id });

  const exportData = await buildUserExport(user.id, logger);

  logger.info({ action: 'exportUserData.complete', userId: user.id });
  return exportData;
}

const DeleteAccountSchema = z.object({
  confirmedEmail: z.string().email(),
});

/**
 * Fully deletes the authenticated user's account.
 * Cascade order: application_documents storage → application_documents rows →
 * voice_sessions → audit_log → applications → profiles → auth user.
 */
export async function deleteAccount(
  confirmedEmail: string
): Promise<{ error?: string }> {
  const parsed = DeleteAccountSchema.safeParse({ confirmedEmail });
  if (!parsed.success) {
    return { error: 'Invalid email.' };
  }

  const supabase = await createSupabaseServerClient() as unknown as SupabaseClient;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new AuthError('Not authenticated');

  if (parsed.data.confirmedEmail.toLowerCase() !== (user.email ?? '').toLowerCase()) {
    return { error: 'Email address does not match your account.' };
  }

  const correlationId = `delete-account-${user.id}-${Date.now()}`;
  const logger = createRequestLogger(correlationId);
  logger.info({ action: 'deleteAccount.start', userId: user.id });

  const admin = createSupabaseAdminClient();

  // 1. Find profile
  const { data: profile, error: profileFetchError } = await admin
    .from('profiles')
    .select('id')
    .eq('auth_user_id', user.id)
    .single();

  if (profileFetchError || !profile) {
    logger.error({ action: 'deleteAccount.profileFetch_error', userId: user.id, error: profileFetchError });
    return { error: 'Failed to locate account data. Please try again.' };
  }

  const profileId = (profile as { id: string }).id;

  // 2. Find all applications
  const { data: apps, error: appsFetchError } = await admin
    .from('applications')
    .select('id')
    .eq('profile_id', profileId);

  if (appsFetchError) {
    logger.error({ action: 'deleteAccount.appsFetch_error', userId: user.id, error: appsFetchError });
    return { error: 'Failed to load application data. Please try again.' };
  }

  const appIds = (apps as { id: string }[] ?? []).map((a) => a.id);

  // 3. Find and delete storage objects for all documents
  if (appIds.length > 0) {
    const { data: docs, error: docsFetchError } = await admin
      .from('application_documents')
      .select('storage_path')
      .in('application_id', appIds);

    if (docsFetchError) {
      logger.error({ action: 'deleteAccount.docsFetch_error', userId: user.id, error: docsFetchError });
      return { error: 'Failed to load document data. Please try again.' };
    }

    const storagePaths = (docs as { storage_path: string }[] ?? []).map((d) => d.storage_path);

    if (storagePaths.length > 0) {
      const { error: storageError } = await admin.storage
        .from('documents')
        .remove(storagePaths);

      if (storageError) {
        // Log but do not abort — orphaned storage objects are recoverable, the account must be deleted
        logger.warn({ action: 'deleteAccount.storage_warn', userId: user.id, error: storageError });
      }
    }

    // 4. Delete application_documents rows
    const { error: docsDeleteError } = await admin
      .from('application_documents')
      .delete()
      .in('application_id', appIds);

    if (docsDeleteError) {
      logger.error({ action: 'deleteAccount.docsDelete_error', userId: user.id, error: docsDeleteError });
      return { error: 'Failed to delete document records. Please try again.' };
    }
  }

  // 5. Delete voice_sessions
  const { error: voiceDeleteError } = await admin
    .from('voice_sessions')
    .delete()
    .eq('profile_id', profileId);

  if (voiceDeleteError) {
    logger.error({ action: 'deleteAccount.voiceDelete_error', userId: user.id, error: voiceDeleteError });
    return { error: 'Failed to delete session data. Please try again.' };
  }

  // 6. Delete audit_log entries for this profile
  const { error: auditDeleteError } = await admin
    .from('audit_log')
    .delete()
    .eq('profile_id', profileId);

  if (auditDeleteError) {
    logger.warn({ action: 'deleteAccount.auditDelete_warn', userId: user.id, error: auditDeleteError });
    // Non-fatal; proceed
  }

  // 7. Delete applications
  if (appIds.length > 0) {
    const { error: appsDeleteError } = await admin
      .from('applications')
      .delete()
      .in('id', appIds);

    if (appsDeleteError) {
      logger.error({ action: 'deleteAccount.appsDelete_error', userId: user.id, error: appsDeleteError });
      return { error: 'Failed to delete application records. Please try again.' };
    }
  }

  // 8. Delete profile row
  const { error: profileDeleteError } = await admin
    .from('profiles')
    .delete()
    .eq('id', profileId);

  if (profileDeleteError) {
    logger.error({ action: 'deleteAccount.profileDelete_error', userId: user.id, error: profileDeleteError });
    return { error: 'Failed to delete profile record. Please try again.' };
  }

  // 9. Delete auth user
  const { error: authDeleteError } = await admin.auth.admin.deleteUser(user.id);
  if (authDeleteError) {
    logger.error({ action: 'deleteAccount.authDelete_error', userId: user.id, error: authDeleteError });
    throw new DatabaseError('Failed to delete auth user', { userId: user.id }, authDeleteError);
  }

  logger.info({ action: 'deleteAccount.complete', userId: user.id });

  // Session is now invalid; redirect to auth
  redirect('/auth/login');
}
