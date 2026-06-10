import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createRequestLogger } from '@/lib/logger';
import { getDashboardData } from '@/modules/dashboard/service';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DocumentsClient } from './DocumentsClient';

/** Documents tab — document checklist locked until a pathway is selected. */
export default async function DocumentsPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  const correlationId = `docs-tab-${user.id}-${Date.now()}`;
  const logger = createRequestLogger(correlationId);
  logger.info({ action: 'documentsTab.start', userId: user.id });

  let data;
  try {
    data = await getDashboardData(user.id, logger);
  } catch (err) {
    logger.error({ action: 'documentsTab.error', userId: user.id, err });
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
            <p
              style={{
                fontFamily: 'var(--pw-font-body)',
                fontSize: 14,
                color: '#6B6B6B',
                marginBottom: 20,
              }}
            >
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

  logger.info({ action: 'documentsTab.complete', userId: user.id });

  return (
    <DashboardShell
      avatarInitials={data.avatarInitials}
      firstName={data.firstName}
      applicationId={data.applicationId}
    >
      <DocumentsClient
        hasApplication={!!data.applicationId}
        dbDocuments={data.documents}
      />
    </DashboardShell>
  );
}
