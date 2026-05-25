import Link from 'next/link';
import { LayoutDashboard, FileText, FolderOpen, User } from 'lucide-react';

interface DashboardShellProps {
  children: React.ReactNode;
  avatarInitials: string;
  firstName: string;
  applicationId?: string | null;
}

interface NavItemProps {
  href: string;
  icon: React.ReactNode;
  label: string;
  disabled?: boolean;
}

function NavItem({ href, icon, label, disabled }: NavItemProps) {
  if (disabled) {
    return (
      <span className="nav-item text-text-disabled cursor-not-allowed w-full px-3 gap-3">
        {icon}
        <span className="text-sm font-medium">{label}</span>
      </span>
    );
  }

  return (
    <Link href={href} className="nav-item w-full px-3 gap-3">
      {icon}
      <span className="text-sm font-medium">{label}</span>
    </Link>
  );
}

/** Persistent dashboard shell: 240px sidebar + scrollable main content area. */
export function DashboardShell({
  children,
  avatarInitials,
  applicationId,
}: DashboardShellProps) {
  return (
    <div className="dashboard-layout">
      {/* Sidebar — hidden below lg breakpoint for MVP */}
      <aside
        className="hidden lg:flex flex-col h-screen bg-bg-surface border-r border-border-light"
        style={{ width: '240px', boxShadow: 'var(--shadow-sidebar)', flexShrink: 0 }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2 px-5 py-6">
          <span
            className="card-title"
            style={{ fontFamily: 'Urbanist, sans-serif', fontWeight: 700, fontSize: '17px' }}
          >
            Pathways
          </span>
          <span
            className="w-2 h-2 rounded-full bg-accent-500 flex-shrink-0"
            aria-hidden="true"
          />
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-1 px-3 flex-1">
          <NavItem
            href="/dashboard"
            icon={<LayoutDashboard size={18} />}
            label="Dashboard"
          />
          <NavItem
            href={applicationId ? `/applications/${applicationId}` : '#'}
            icon={<FileText size={18} />}
            label="Application"
            disabled={!applicationId}
          />
          <NavItem
            href={applicationId ? `/applications/${applicationId}/documents` : '#'}
            icon={<FolderOpen size={18} />}
            label="Documents"
            disabled={!applicationId}
          />
          {/* /profile does not exist yet — rendered disabled */}
          <NavItem
            href="#"
            icon={<User size={18} />}
            label="Profile"
            disabled
          />
        </nav>

        {/* Avatar */}
        <div className="px-5 py-6">
          <div
            className="flex items-center justify-center rounded-full bg-accent-600 text-white select-none"
            style={{ width: 36, height: 36, fontSize: 13, fontWeight: 600, fontFamily: 'Urbanist, sans-serif' }}
            aria-label="User avatar"
          >
            {avatarInitials}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="dashboard-content">
        {children}
      </main>
    </div>
  );
}
