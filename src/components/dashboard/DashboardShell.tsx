import { TopNav } from './TopNav';

interface DashboardShellProps {
  children: React.ReactNode;
  avatarInitials: string;
  firstName: string;
  applicationId?: string | null;
}

/** Full-viewport shell: top nav + hairline divider + scrollable main area. */
export function DashboardShell({
  children,
  avatarInitials,
  firstName,
  applicationId,
}: DashboardShellProps) {
  return (
    <div className="h-screen overflow-hidden flex flex-col bg-bg-base">
      <TopNav
        avatarInitials={avatarInitials}
        firstName={firstName}
        applicationId={applicationId}
      />
      <main className="flex-1 overflow-hidden flex flex-col">
        {children}
      </main>
    </div>
  );
}
