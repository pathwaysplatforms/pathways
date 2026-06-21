import type { Logger } from 'pino';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { DatabaseError, NotFoundError } from '@/lib/errors';
import type { AccountData, UserExportData } from './types';

/** Fetches auth-level account data (email, session timestamps) for the account page. */
export async function getAccountData(userId: string, logger: Logger): Promise<AccountData> {
  logger.info({ action: 'getAccountData.start', userId });

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.auth.admin.getUserById(userId);

  if (error || !data.user) {
    logger.error({ action: 'getAccountData.error', userId, error });
    throw new DatabaseError('Failed to fetch account data', { userId }, error ?? undefined);
  }

  logger.info({ action: 'getAccountData.complete', userId });

  return {
    email: data.user.email ?? '',
    lastSignInAt: data.user.last_sign_in_at ?? null,
    createdAt: data.user.created_at,
  };
}

/**
 * Compiles all user-owned data into a single exportable structure.
 * Reads: profiles, applications (with pathway title), application_documents.
 */
export async function buildUserExport(userId: string, logger: Logger): Promise<UserExportData> {
  logger.info({ action: 'buildUserExport.start', userId });

  const admin = createSupabaseAdminClient();

  // Fetch auth user for email
  const { data: authData, error: authError } = await admin.auth.admin.getUserById(userId);
  if (authError || !authData.user) {
    throw new DatabaseError('Failed to fetch auth user for export', { userId }, authError ?? undefined);
  }

  // Fetch profile
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('*')
    .eq('auth_user_id', userId)
    .single();

  if (profileError || !profile) {
    throw profileError && (profileError as { code?: string }).code === 'PGRST116'
      ? new NotFoundError('Profile not found', { userId })
      : new DatabaseError('Failed to fetch profile for export', { userId }, profileError ?? undefined);
  }

  type ProfileRow = {
    id: string;
    full_name: string | null;
    nationality: string | null;
    current_country: string | null;
    date_of_birth: string | null;
    marital_status: string | null;
    occupation: string | null;
    years_experience: number | null;
    education_level: string | null;
    created_at: string;
  };
  const p = profile as unknown as ProfileRow;

  // Fetch applications with pathway name and documents
  const { data: apps, error: appsError } = await admin
    .from('applications')
    .select('id, status, created_at, pathways(title), application_documents(id, original_filename, status, uploaded_at)')
    .eq('profile_id', p.id);

  if (appsError) {
    throw new DatabaseError('Failed to fetch applications for export', { userId, profileId: p.id }, appsError);
  }

  type AppRow = {
    id: string;
    status: string;
    created_at: string;
    pathways: { title: string } | null;
    application_documents: Array<{
      id: string;
      original_filename: string;
      status: string;
      uploaded_at: string;
    }>;
  };

  const exportData: UserExportData = {
    exportedAt: new Date().toISOString(),
    profile: {
      fullName: p.full_name,
      email: authData.user.email ?? '',
      nationality: p.nationality,
      currentCountry: p.current_country,
      dateOfBirth: p.date_of_birth,
      maritalStatus: p.marital_status,
      occupation: p.occupation,
      yearsExperience: p.years_experience,
      educationLevel: p.education_level,
      createdAt: p.created_at,
    },
    applications: (apps as unknown as AppRow[]).map((app) => ({
      id: app.id,
      status: app.status,
      pathway: app.pathways?.title ?? null,
      createdAt: app.created_at,
      documents: (app.application_documents ?? []).map((doc) => ({
        id: doc.id,
        filename: doc.original_filename,
        status: doc.status,
        uploadedAt: doc.uploaded_at,
      })),
    })),
  };

  logger.info({ action: 'buildUserExport.complete', userId });
  return exportData;
}
