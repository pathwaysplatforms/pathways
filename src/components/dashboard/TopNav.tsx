'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Route, Files, User, type LucideIcon } from 'lucide-react';

interface TopNavProps {
  avatarInitials: string;
  firstName: string;
  applicationId?: string | null;
}

interface NavItemDef {
  label: string;
  icon: LucideIcon;
  href: string;
  disabled: boolean;
}

/** Horizontal top navigation bar. */
export function TopNav({ avatarInitials, firstName, applicationId }: TopNavProps) {
  const pathname = usePathname();

  const navItems: NavItemDef[] = [
    { label: 'Dashboard',   icon: LayoutDashboard, href: '/dashboard',                                               disabled: false },
    { label: 'Application', icon: Route,            href: applicationId ? `/applications/${applicationId}` : '#',   disabled: !applicationId },
    { label: 'Documents',   icon: Files,            href: applicationId ? `/applications/${applicationId}/documents` : '#', disabled: !applicationId },
    { label: 'Profile',     icon: User,             href: '#',                                                       disabled: true },
  ];

  return (
    <nav
      className="h-16 flex items-center justify-between px-8 flex-shrink-0 bg-bg-base"
      aria-label="Main navigation"
    >
      {/* Logo */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <span
          className="text-text-primary font-extrabold"
          style={{ fontSize: '20px', letterSpacing: '-0.02em' }}
        >
          Pathways
        </span>
        <span className="w-1.5 h-1.5 rounded-full bg-accent-500 flex-shrink-0" aria-hidden="true" />
      </div>

      {/* Nav links — pill container */}
      <div
        className="flex items-center gap-1 rounded-full px-1.5 py-1"
        style={{ background: 'var(--color-bg-subtle)' }}
      >
        {navItems.map(({ label, icon: Icon, href, disabled }) => {
          const isActive = !disabled && (pathname === href || (href !== '#' && pathname.startsWith(href)));

          if (disabled) {
            return (
              <span
                key={label}
                className="flex items-center gap-2 px-4 py-2 rounded-full text-text-disabled cursor-not-allowed select-none"
                style={{ fontSize: '14px', fontWeight: 500 }}
              >
                <Icon size={14} />
                {label}
              </span>
            );
          }

          return (
            <Link
              key={label}
              href={href}
              className={[
                'flex items-center gap-2 px-4 py-2 rounded-full transition-colors',
                isActive
                  ? 'bg-bg-surface text-accent-600 shadow-sm'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-surface/70',
              ].join(' ')}
              style={{ fontSize: '14px', fontWeight: isActive ? 600 : 500 }}
            >
              <Icon size={14} />
              {label}
            </Link>
          );
        })}
      </div>

      {/* User */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <span className="text-text-secondary" style={{ fontSize: '14px', fontWeight: 500 }}>
          {firstName}
        </span>
        <div
          className="flex items-center justify-center rounded-full bg-accent-600 text-white select-none flex-shrink-0"
          style={{ width: 34, height: 34, fontSize: 12, fontWeight: 600 }}
          aria-label="User avatar"
        >
          {avatarInitials}
        </div>
      </div>
    </nav>
  );
}
