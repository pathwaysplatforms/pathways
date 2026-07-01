'use client';

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { ProfileClient } from '@/app/dashboard/profile/ProfileClient';
import { AccountClient } from '@/app/dashboard/account/AccountClient';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import type { ProfileTabData } from '@/modules/profile/types';
import type { AccountData } from '@/modules/account/types';

type Tab = 'profile' | 'settings';

interface ProfileSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ProfileFetch =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok'; data: ProfileTabData }
  | { status: 'error' };

type AccountFetch =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok'; data: AccountData; userEmail: string }
  | { status: 'error' };

/** Profile/Settings overlay modal. Plane stays mounted underneath — NOT deactivated. */
export function ProfileSettingsModal({ isOpen, onClose }: ProfileSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const [isClosing, setIsClosing] = useState(false);
  const reducedMotion = useReducedMotion();
  const [profileFetch, setProfileFetch] = useState<ProfileFetch>({ status: 'idle' });
  const [accountFetch, setAccountFetch] = useState<AccountFetch>({ status: 'idle' });
  const hasFetchedProfileRef = useRef(false);
  const hasFetchedAccountRef = useRef(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Fetch profile data on first open.
  useEffect(() => {
    if (!isOpen || hasFetchedProfileRef.current) return;
    hasFetchedProfileRef.current = true;
    let cancelled = false;

    async function load() {
      setProfileFetch({ status: 'loading' });
      try {
        const res = await fetch('/api/profile/tab-data');
        if (cancelled) return;
        if (!res.ok) { setProfileFetch({ status: 'error' }); return; }
        const json = (await res.json()) as { data: ProfileTabData };
        if (!cancelled) setProfileFetch({ status: 'ok', data: json.data });
      } catch {
        if (!cancelled) setProfileFetch({ status: 'error' });
      }
    }

    void load();
    return () => {
      cancelled = true;
      hasFetchedProfileRef.current = false;
    };
  }, [isOpen]);

  // Fetch account data when settings tab is first selected while modal is open.
  useEffect(() => {
    if (!isOpen || activeTab !== 'settings' || hasFetchedAccountRef.current) return;
    hasFetchedAccountRef.current = true;
    let cancelled = false;

    async function load() {
      setAccountFetch({ status: 'loading' });
      try {
        const res = await fetch('/api/account/tab-data');
        if (cancelled) return;
        if (!res.ok) { setAccountFetch({ status: 'error' }); return; }
        const json = (await res.json()) as { data: AccountData; userEmail: string };
        if (!cancelled) setAccountFetch({ status: 'ok', data: json.data, userEmail: json.userEmail });
      } catch {
        if (!cancelled) setAccountFetch({ status: 'error' });
      }
    }

    void load();
    return () => {
      cancelled = true;
      hasFetchedAccountRef.current = false;
    };
  }, [isOpen, activeTab]);

  // Escape key closes the modal.
  useEffect(() => {
    if (!isOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  function close() {
    if (reducedMotion) {
      // Skip animation state — close immediately.
      onClose();
    } else {
      setIsClosing(true);
    }
  }

  function handleAnimationEnd() {
    if (isClosing) {
      setIsClosing(false);
      onClose();
    }
  }

  if (!isOpen && !isClosing) return null;

  const closingClass = isClosing ? ' is-closing' : '';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'flex-start',
        paddingTop: 72,
        paddingRight: 24,
      }}
    >
      {/* Backdrop */}
      <div
        className={`pw-modal-backdrop${closingClass}`}
        onClick={close}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.30)',
        }}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={activeTab === 'profile' ? 'Profile' : 'Account settings'}
        className={`pw-modal-panel${closingClass}`}
        onAnimationEnd={handleAnimationEnd}
        style={{
          position: 'relative',
          zIndex: 1,
          width: '100%',
          maxWidth: 640,
          maxHeight: 'calc(100vh - 96px)',
          background: '#fff',
          border: '1px solid rgba(0,0,0,0.08)',
          borderRadius: 16,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Modal header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid rgba(0,0,0,0.08)',
            flexShrink: 0,
          }}
        >
          {/* Tab switcher */}
          <div style={{ display: 'flex', gap: 2, background: 'rgba(0,0,0,0.04)', borderRadius: 8, padding: 3 }}>
            {(['profile', 'settings'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                style={{
                  fontFamily: 'var(--pw-font-body)',
                  fontSize: 13,
                  fontWeight: 400,
                  color: activeTab === tab ? 'var(--pw-ink)' : 'var(--pw-muted)',
                  background: activeTab === tab ? '#fff' : 'transparent',
                  border: 'none',
                  borderRadius: 6,
                  padding: '5px 14px',
                  cursor: 'pointer',
                  boxShadow: activeTab === tab ? '0 1px 3px rgba(0,0,0,0.10)' : 'none',
                  transition: 'background 120ms, color 120ms, box-shadow 120ms',
                }}
              >
                {tab === 'profile' ? 'Profile' : 'Settings'}
              </button>
            ))}
          </div>

          {/* Close button */}
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              border: 'none',
              background: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              color: 'var(--pw-muted)',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal body */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {activeTab === 'profile' && (
            <>
              {(profileFetch.status === 'idle' || profileFetch.status === 'loading') && (
                <ModalSpinner />
              )}
              {profileFetch.status === 'error' && (
                <ModalError
                  message="We couldn't load your profile. Please try again."
                  onRetry={() => { hasFetchedProfileRef.current = false; setProfileFetch({ status: 'idle' }); }}
                />
              )}
              {profileFetch.status === 'ok' && (
                <ProfileClient data={profileFetch.data} />
              )}
            </>
          )}

          {activeTab === 'settings' && (
            <>
              {(accountFetch.status === 'idle' || accountFetch.status === 'loading') && (
                <ModalSpinner />
              )}
              {accountFetch.status === 'error' && (
                <ModalError
                  message="We couldn't load your account settings. Please try again."
                  onRetry={() => { hasFetchedAccountRef.current = false; setAccountFetch({ status: 'idle' }); }}
                />
              )}
              {accountFetch.status === 'ok' && (
                <AccountClient
                  accountData={accountFetch.data}
                  userEmail={accountFetch.userEmail}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ModalSpinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48 }}>
      <div
        style={{
          width: 24, height: 24, borderRadius: '50%',
          border: '2px solid rgba(0,0,0,0.08)',
          borderTopColor: 'var(--pw-ink)',
          animation: 'spin 0.7s linear infinite',
        }}
      />
    </div>
  );
}

function ModalError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 48, textAlign: 'center', gap: 12 }}>
      <p style={{ fontFamily: 'var(--pw-font-body)', fontSize: 14, color: 'var(--pw-muted)' }}>{message}</p>
      <button
        type="button"
        onClick={onRetry}
        style={{
          fontFamily: 'var(--pw-font-body)', fontSize: 13, fontWeight: 500,
          color: '#fff', background: 'var(--pw-ink)', border: 'none', borderRadius: 8,
          padding: '8px 18px', cursor: 'pointer',
        }}
      >
        Retry
      </button>
    </div>
  );
}
