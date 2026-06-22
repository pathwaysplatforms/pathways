import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createRequestLogger } from '@/lib/logger';
import { getAccountData } from '@/modules/account/service';
import { getProfileTabData } from '@/modules/profile/service';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { AccountClient } from './AccountClient';

/** Account settings page — email, sessions, data export, delete account. */
export default async function AccountPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  const correlationId = `account-page-${user.id}-${Date.now()}`;
  const logger = createRequestLogger(correlationId);
  logger.info({ action: 'accountPage.start', userId: user.id });

  let accountData;
  let avatarInitials = '?';
  let firstName = '';

  try {
    [accountData] = await Promise.all([
      getAccountData(user.id, logger),
    ]);

    // Best-effort: get name/initials from profile without hard-failing the page
    try {
      const profileData = await getProfileTabData(user.id, logger);
      avatarInitials = profileData.avatarInitials;
      firstName = profileData.firstName;
    } catch {
      // Profile may not exist for new users — fall back to email initial
      avatarInitials = (user.email?.[0] ?? '?').toUpperCase();
      firstName = user.email?.split('@')[0] ?? '';
    }
  } catch (err) {
    logger.error({ action: 'accountPage.error', userId: user.id, err });
    return (
      <DashboardShell avatarInitials="?" firstName="">
        <div className="flex flex-1 items-center justify-center p-7">
          <div className="pw-card" style={{ maxWidth: 400, textAlign: 'center' }}>
            <p
              style={{
                fontFamily: 'var(--pw-font-display)',
                fontSize: '1.25rem',
                color: '#0D0D0D',
                marginBottom: 8,
              }}
            >
              Something went wrong
            </p>
            <p
              style={{
                fontFamily: 'var(--pw-font-body)',
                fontSize: 13,
                color: '#6B6B6B',
                marginBottom: 20,
              }}
            >
              We could not load your account settings. Please try again.
            </p>
            <a
              href="/dashboard/account"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '8px 20px',
                fontFamily: 'var(--pw-font-ui)',
                fontSize: 13,
                fontWeight: 500,
                color: '#fff',
                background: '#0D0D0D',
                borderRadius: 0,
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

  logger.info({ action: 'accountPage.complete', userId: user.id });

  return (
    <DashboardShell avatarInitials={avatarInitials} firstName={firstName}>
      <AccountClient accountData={accountData} userEmail={user.email ?? ''} />
    </DashboardShell>
  );
}
