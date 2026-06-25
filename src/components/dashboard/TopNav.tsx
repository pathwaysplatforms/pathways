'use client';

import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Route, Files, User, ChevronDown, Settings, LogOut, type LucideIcon } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import type { SubscriptionStatus } from '@/modules/account/types';

interface TopNavProps {
  avatarInitials: string;
  firstName: string;
  applicationId?: string | null;
  subscriptionStatus?: SubscriptionStatus;
}

interface NavItemDef {
  label: string;
  icon: LucideIcon;
  href: string;
  disabled: boolean;
}

const TIER_LABELS: Record<SubscriptionStatus, string> = {
  guest: 'Guest',
  free: 'Free',
  paid: 'Pro',
};

/** Horizontal top navigation bar — white, hairline border, Swiss typography. */
export function TopNav({ avatarInitials, firstName, applicationId, subscriptionStatus = 'free' }: TopNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [tabsReady, setTabsReady] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setTabsReady(true), 50);
    return () => clearTimeout(t);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return;
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [dropdownOpen]);

  // Close dropdown on Escape
  useEffect(() => {
    if (!dropdownOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setDropdownOpen(false);
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [dropdownOpen]);

  async function handleSignOut() {
    setSigningOut(true);
    setDropdownOpen(false);
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push('/auth/login');
  }

  const navItems: NavItemDef[] = [
    { label: 'Dashboard',   icon: LayoutDashboard, href: '/dashboard',               disabled: false },
    { label: 'Application', icon: Route,            href: '/dashboard/application',   disabled: false },
    { label: 'Documents',   icon: Files,            href: '/dashboard/documents',     disabled: false },
    { label: 'Profile',     icon: User,             href: '/dashboard/profile',       disabled: false },
    { label: 'Settings',    icon: Settings,         href: '/dashboard/account',       disabled: false },
  ];

  const isPaid = subscriptionStatus === 'paid';

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

      {/* Account area */}
      <div ref={dropdownRef} className="flex items-center gap-3 flex-shrink-0" style={{ position: 'relative' }}>
        {/* Subscription badge */}
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '2px 8px',
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 500,
            fontFamily: 'var(--pw-font-body)',
            backgroundColor: isPaid ? 'var(--pw-accent)' : 'rgba(0,0,0,0.06)',
            color: isPaid ? '#fff' : 'var(--pw-muted)',
          }}
        >
          {TIER_LABELS[subscriptionStatus]}
        </span>

        {/* Avatar button */}
        <button
          type="button"
          onClick={() => setDropdownOpen((v) => !v)}
          aria-label="Account menu"
          aria-expanded={dropdownOpen}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '2px 4px',
            borderRadius: 9999,
          }}
        >
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
            aria-hidden="true"
          >
            {avatarInitials}
          </div>
          <ChevronDown
            size={13}
            color="var(--pw-muted)"
            style={{ transition: 'transform 0.15s', transform: dropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
          />
        </button>

        {/* Dropdown */}
        {dropdownOpen && (
          <div
            role="menu"
            style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              right: 0,
              minWidth: 180,
              backgroundColor: '#fff',
              border: '1px solid var(--pw-border)',
              borderRadius: 12,
              boxShadow: '0 8px 32px rgba(0,0,0,0.10)',
              overflow: 'hidden',
              zIndex: 100,
            }}
          >
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--pw-border)' }}>
              <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--pw-ink)', fontFamily: 'var(--pw-font-body)' }}>
                {firstName}
              </p>
              <p style={{ fontSize: 11, color: 'var(--pw-muted)', fontFamily: 'var(--pw-font-body)' }}>
                {TIER_LABELS[subscriptionStatus]} plan
              </p>
            </div>

            <Link
              href="/account"
              role="menuitem"
              onClick={() => setDropdownOpen(false)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 14px',
                fontSize: 14,
                fontFamily: 'var(--pw-font-body)',
                color: 'var(--pw-ink)',
                textDecoration: 'none',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(0,0,0,0.04)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
            >
              <Settings size={14} color="var(--pw-muted)" />
              Account settings
            </Link>

            <button
              type="button"
              role="menuitem"
              onClick={handleSignOut}
              disabled={signingOut}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                width: '100%',
                padding: '10px 14px',
                fontSize: 14,
                fontFamily: 'var(--pw-font-body)',
                color: signingOut ? 'var(--pw-muted)' : 'var(--pw-ink)',
                background: 'none',
                border: 'none',
                cursor: signingOut ? 'not-allowed' : 'pointer',
                textAlign: 'left',
                borderTop: '1px solid var(--pw-border)',
              }}
              onMouseEnter={(e) => { if (!signingOut) (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(0,0,0,0.04)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
            >
              <LogOut size={14} color="var(--pw-muted)" />
              {signingOut ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
