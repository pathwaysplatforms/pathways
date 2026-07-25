'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Route,
  Files,
  Map,
  TrendingUp,
  User,
  Settings,
  ChevronDown,
  LogOut,
  type LucideIcon,
} from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import type { SubscriptionStatus } from '@/modules/account/types';

interface TopNavProps {
  avatarInitials: string;
  firstName: string;
  subscriptionStatus?: SubscriptionStatus;
  /** The active plane index (0–4), or -1 when not in the plane. Defaults to -1. */
  activeIndex?: number;
  /** Called when a plane nav item is clicked. */
  onNavigate?: (index: number) => void;
  /** Called when Profile or Settings is selected from the avatar dropdown. */
  onOpenModal?: () => void;
}

interface NavItemDef {
  label: string;
  icon: LucideIcon;
  index: number;
}

const TIER_LABELS: Record<SubscriptionStatus, string> = {
  guest: 'Guest',
  free: 'Free',
  paid: 'Pro',
};

const navItems: NavItemDef[] = [
  { label: 'Dashboard',     icon: LayoutDashboard, index: 0 },
  { label: 'Application',   icon: Route,           index: 1 },
  { label: 'Documents',     icon: Files,           index: 2 },
  { label: 'Pathways',      icon: Map,             index: 3 },
  { label: 'Draws Tracker', icon: TrendingUp,      index: 4 },
];

/** Horizontal top navigation bar — white, hairline border, Swiss typography. */
export function TopNav({
  avatarInitials,
  firstName,
  subscriptionStatus = 'free',
  activeIndex = -1,
  onNavigate = () => {},
  onOpenModal = () => {},
}: TopNavProps) {
  const router = useRouter();
  const [tabsReady, setTabsReady] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setTabsReady(true), 50);
    return () => clearTimeout(t);
  }, []);

  // Close dropdown on outside click.
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

  // Close dropdown on Escape.
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

  function handleModalOpen() {
    setDropdownOpen(false);
    onOpenModal();
  }

  return (
    <nav
      className="pw-topnav-glass h-12 flex items-center px-8 flex-shrink-0"
      aria-label="Main navigation"
    >
      {/* Wordmark */}
      <div className="flex-1 flex items-center gap-2">
        <span
          className="text-pw-ink"
          style={{ fontFamily: 'var(--pw-font-display)', fontSize: 20, fontWeight: 600 }}
        >
          Pathways
        </span>
        <span className="w-1.5 h-1.5 rounded-full bg-pw-accent flex-shrink-0" aria-hidden="true" />
      </div>

      {/* Nav buttons */}
      <div className="flex items-center h-full">
        {navItems.map(({ label, icon: Icon, index }) => {
          const isActive = activeIndex === index;
          const isHovered = hoveredIndex === index;

          const tabClass = [
            'pw-nav-tab',
            'flex items-center gap-2 px-4 h-full',
            isActive ? 'active' : '',
            !tabsReady ? 'no-transition' : '',
          ].filter(Boolean).join(' ');

          return (
            <button
              key={label}
              type="button"
              className={tabClass}
              onClick={() => onNavigate(index)}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
              style={{
                fontSize: 14,
                fontWeight: 400,
                fontFamily: 'var(--pw-font-body)',
                color: (isActive || isHovered) ? 'var(--pw-ink)' : 'var(--pw-muted)',
                transition: 'color 90ms ease',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <Icon size={14} />
              {label}
            </button>
          );
        })}
      </div>

      {/* Account area */}
      <div ref={dropdownRef} className="flex-1 flex justify-end items-center" style={{ position: 'relative' }}>
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

            <button
              type="button"
              role="menuitem"
              onClick={handleModalOpen}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                width: '100%',
                padding: '10px 14px',
                fontSize: 14,
                fontFamily: 'var(--pw-font-body)',
                color: 'var(--pw-ink)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(0,0,0,0.04)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
            >
              <User size={14} color="var(--pw-muted)" />
              Profile
            </button>

            <button
              type="button"
              role="menuitem"
              onClick={handleModalOpen}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                width: '100%',
                padding: '10px 14px',
                fontSize: 14,
                fontFamily: 'var(--pw-font-body)',
                color: 'var(--pw-ink)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(0,0,0,0.04)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
            >
              <Settings size={14} color="var(--pw-muted)" />
              Account settings
            </button>

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
