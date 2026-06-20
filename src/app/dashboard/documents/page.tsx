import { redirect } from 'next/navigation';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createRequestLogger } from '@/lib/logger';
import { listVaultFiles } from '@/modules/vault/service';
import type { VaultFile } from '@/modules/vault/types';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DocumentsClient } from './DocumentsClient';

/** Derives avatar initials (up to 2 chars) from a full name. */
function deriveInitials(fullName: string | null): string {
  if (!fullName) return '?';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return (parts[0]?.[0] ?? '?').toUpperCase();
  return `${parts[0]?.[0] ?? ''}${parts[parts.length - 1]?.[0] ?? ''}`.toUpperCase();
}

/** Extracts the first name from a full name string. */
function deriveFirstName(fullName: string | null): string {
  if (!fullName) return 'there';
  return fullName.split(' ')[0] ?? 'there';
}

/** Documents tab — general-purpose file vault for all authenticated users. */
export default async function DocumentsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/auth/login');

  const correlationId = `docs-tab-${user.id}-${Date.now()}`;
  const logger = createRequestLogger(correlationId);
  logger.info({ action: 'documentsTab.start', userId: user.id });

  const db = supabase as unknown as SupabaseClient;

  // Fetch profile to get display name and profile id
  const { data: profileData, error: profileError } = await db
    .from('profiles')
    .select('id, full_name')
    .eq('auth_user_id', user.id)
    .single();

  if (profileError || !profileData) {
    logger.error({ action: 'documentsTab.profileError', userId: user.id, error: profileError });
    return (
      <DashboardShell avatarInitials="?" firstName="">
        <div className="flex flex-1 items-center justify-center p-7">
          <div
            className="pw-entry is-visible"
            style={{
              maxWidth: 400,
              textAlign: 'center',
              padding: '32px 28px',
              border: '1px solid rgba(0,0,0,0.08)',
              borderRadius: 12,
            }}
          >
            <p
              style={{
                fontFamily: 'var(--pw-font-display)',
                fontSize: '1.5rem',
                color: '#0D0D0D',
                marginBottom: 8,
              }}
            >
              Something went wrong
            </p>
            <p style={{ fontFamily: 'var(--pw-font-body)', fontSize: 14, color: '#6B6B6B', marginBottom: 20 }}>
              We couldn&apos;t load your documents. Please try again.
            </p>
            <a
              href="/dashboard/documents"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '9px 20px',
                fontFamily: 'var(--pw-font-body)',
                fontSize: 14,
                fontWeight: 500,
                color: '#fff',
                background: '#0D0D0D',
                borderRadius: 9999,
                textDecoration: 'none',
              }}
            >
              Retry
            </a>
          </div>
        </div>
      </DashboardShell>
    );
  }

  const profile = profileData as { id: string; full_name: string | null };

  let initialFiles: VaultFile[];
  try {
    initialFiles = await listVaultFiles(profile.id, db, logger);
  } catch (err) {
    logger.error({ action: 'documentsTab.vaultError', userId: user.id, err });
    initialFiles = [];
  }

  logger.info({ action: 'documentsTab.complete', userId: user.id, fileCount: initialFiles.length });

  return (
    <DashboardShell
      avatarInitials={deriveInitials(profile.full_name)}
      firstName={deriveFirstName(profile.full_name)}
    >
      <DocumentsClient initialFiles={initialFiles} />
    </DashboardShell>
  );
}
