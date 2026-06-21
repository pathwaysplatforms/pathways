'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Route, Files, User, Settings, type LucideIcon } from 'lucide-react';

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

/** Horizontal top navigation bar — white, hairline border, Swiss typography. */
export function TopNav({ avatarInitials, firstName, applicationId }: TopNavProps) {
  const pathname = usePathname();
  const [tabsReady, setTabsReady] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setTabsReady(true), 50);
    return () => clearTimeout(t);
  }, []);

  const navItems: NavItemDef[] = [
    { label: 'Dashboard',   icon: LayoutDashboard, href: '/dashboard',               disabled: false },
    { label: 'Application', icon: Route,            href: '/dashboard/application',   disabled: false },
    { label: 'Documents',   icon: Files,            href: '/dashboard/documents',     disabled: false },
    { label: 'Profile',     icon: User,             href: '/dashboard/profile',       disabled: false },
    { label: 'Account',     icon: Settings,         href: '/dashboard/account',       disabled: false },
  ];

  return (
    <nav
      className="h-16 flex items-center justify-between px-8 flex-shrink-0 bg-white border-b border-black/[0.08]"
      aria-label="Main navigation"
    >
      {/* Wordmark */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <span
          className="text-pw-ink"
          style={{ fontFamily: 'var(--pw-font-display)', fontSize: 20, fontWeight: 600 }}
        >
          Pathways
        </span>
        <span className="w-1.5 h-1.5 rounded-full bg-pw-accent flex-shrink-0" aria-hidden="true" />
      </div>

      {/* Nav links */}
      <div className="flex items-center h-full">
        {navItems.map(({ label, icon: Icon, href, disabled }) => {
          const isActive =
            !disabled &&
            (pathname === href ||
              (href !== '#' &&
                href !== '/dashboard' &&
                pathname.startsWith(href)));

          if (disabled) {
            return (
              <span
                key={label}
                className="flex items-center gap-2 px-4 h-full cursor-not-allowed select-none"
                style={{
                  fontSize: 14,
                  fontWeight: 400,
                  fontFamily: 'var(--pw-font-body)',
                  color: 'rgba(0,0,0,0.2)',
                }}
              >
                <Icon size={14} />
                {label}
              </span>
            );
          }

          const tabClass = [
            'pw-nav-tab',
            'flex items-center gap-2 px-4 h-full',
            isActive ? 'active' : '',
            !tabsReady ? 'no-transition' : '',
          ].filter(Boolean).join(' ');

          return (
            <Link
              key={label}
              href={href}
              className={tabClass}
              style={{
                fontSize: 14,
                fontWeight: 400,
                fontFamily: 'var(--pw-font-body)',
                color: isActive ? 'var(--pw-ink)' : 'var(--pw-muted)',
              }}
            >
              <Icon size={14} />
              {label}
            </Link>
          );
        })}
      </div>

      {/* User avatar */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <span
          style={{
            fontSize: 14,
            fontWeight: 500,
            fontFamily: 'var(--pw-font-body)',
            color: 'var(--pw-muted)',
          }}
        >
          {firstName}
        </span>
        <div
          className="flex items-center justify-center rounded-full bg-pw-ink text-white select-none flex-shrink-0"
          style={{ width: 34, height: 34, fontSize: 12, fontFamily: 'var(--pw-font-body)' }}
          aria-label="User avatar"
        >
          {avatarInitials}
        </div>
      </div>
    </nav>
  );
}
