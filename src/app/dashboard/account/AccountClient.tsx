'use client';

import { useState, useTransition, useRef, useEffect } from 'react';
import type { AccountData } from '@/modules/account/types';
import { changeEmail, signOutEverywhere, exportUserData, deleteAccount } from '@/app/actions/account';

interface AccountClientProps {
  accountData: AccountData;
  userEmail: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return 'Never';
  return new Date(iso).toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 36 }}>
      <p className="pw-eyebrow" style={{ marginBottom: 14 }}>{title}</p>
      <div style={{ height: 1, background: 'rgba(0,0,0,0.07)', marginBottom: 20 }} />
      {children}
    </section>
  );
}

// ─── Ghost button ─────────────────────────────────────────────────────────────

function GhostButton({
  children,
  onClick,
  disabled = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={(e) => {
        if (!disabled) {
          (e.currentTarget as HTMLButtonElement).style.background = '#0D0D0D';
          (e.currentTarget as HTMLButtonElement).style.color = '#fff';
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled) {
          (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
          (e.currentTarget as HTMLButtonElement).style.color = disabled ? '#9B9B9B' : '#0D0D0D';
        }
      }}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '8px 20px',
        fontFamily: 'var(--pw-font-ui)',
        fontSize: 13,
        fontWeight: 500,
        color: disabled ? '#9B9B9B' : '#0D0D0D',
        background: 'transparent',
        border: '1px solid',
        borderColor: disabled ? 'rgba(0,0,0,0.15)' : '#0D0D0D',
        borderRadius: 0,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background 150ms ease, color 150ms ease',
      }}
    >
      {children}
    </button>
  );
}

// ─── Delete modal ─────────────────────────────────────────────────────────────

function DeleteModal({
  userEmail,
  onClose,
}: {
  userEmail: string;
  onClose: () => void;
}) {
  const [confirmInput, setConfirmInput] = useState('');
  const [isDeleting, startDeleteTransition] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') onClose();
  }

  function handleDelete() {
    setDeleteError(null);
    startDeleteTransition(async () => {
      const result = await deleteAccount(confirmInput);
      if (result?.error) setDeleteError(result.error);
    });
  }

  const canDelete = confirmInput.toLowerCase() === userEmail.toLowerCase() && !isDeleting;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-dialog-title"
      onKeyDown={handleKeyDown}
      style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
    >
      {/* Overlay */}
      <div
        aria-hidden="true"
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)' }}
      />

      {/* Dialog */}
      <div
        className="pw-card"
        style={{ position: 'relative', width: '100%', maxWidth: 480, zIndex: 1 }}
      >
        <p
          id="delete-dialog-title"
          style={{ fontFamily: 'var(--pw-font-display)', fontSize: '1.25rem', color: '#0D0D0D', marginBottom: 12 }}
        >
          Delete your account
        </p>
        <p style={{ fontFamily: 'var(--pw-font-body)', fontSize: 13, color: '#6B6B6B', lineHeight: 1.6, marginBottom: 20 }}>
          This is permanent and cannot be undone. All your profile data, applications, and documents
          will be erased. To confirm, type your email address below.
        </p>

        <label style={{ display: 'block', fontFamily: 'var(--pw-font-body)', fontSize: 12, color: '#9B9B9B', marginBottom: 6 }}>
          Your email
        </label>
        <input
          ref={inputRef}
          type="email"
          value={confirmInput}
          onChange={(e) => setConfirmInput(e.target.value)}
          placeholder={userEmail}
          autoComplete="off"
          style={{
            width: '100%',
            padding: '9px 12px',
            fontFamily: 'var(--pw-font-body)',
            fontSize: 14,
            border: '1px solid rgba(0,0,0,0.15)',
            borderRadius: 0,
            outline: 'none',
            color: '#0D0D0D',
            background: 'transparent',
            marginBottom: deleteError ? 8 : 20,
            transition: 'border-color 150ms ease',
          }}
          onFocus={(e) => { (e.target as HTMLInputElement).style.borderColor = 'var(--pw-error)'; }}
          onBlur={(e) => { (e.target as HTMLInputElement).style.borderColor = 'rgba(0,0,0,0.15)'; }}
        />

        {deleteError && (
          <p style={{ fontFamily: 'var(--pw-font-body)', fontSize: 12, color: 'var(--pw-error)', marginBottom: 16 }}>
            {deleteError}
          </p>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button
            type="button"
            onClick={handleDelete}
            disabled={!canDelete}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '8px 20px',
              fontFamily: 'var(--pw-font-ui)',
              fontSize: 13,
              fontWeight: 500,
              color: '#fff',
              background: canDelete ? 'var(--pw-error)' : 'rgba(0,0,0,0.2)',
              border: 'none',
              borderRadius: 0,
              cursor: canDelete ? 'pointer' : 'not-allowed',
              transition: 'background 150ms ease',
            }}
          >
            {isDeleting ? 'Deleting…' : 'Delete my account'}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#0D0D0D'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#9B9B9B'; }}
            style={{
              background: 'transparent',
              border: 'none',
              fontFamily: 'var(--pw-font-ui)',
              fontSize: 13,
              color: '#9B9B9B',
              cursor: isDeleting ? 'not-allowed' : 'pointer',
              padding: 0,
              transition: 'color 150ms ease',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

/** Account settings — email, sessions, data export, delete account. */
export function AccountClient({ accountData, userEmail }: AccountClientProps) {
  const [newEmail, setNewEmail] = useState('');
  const [isChangingEmail, startEmailTransition] = useTransition();
  const [emailStatus, setEmailStatus] = useState<'idle' | 'sent' | 'error'>('idle');
  const [emailError, setEmailError] = useState<string | null>(null);

  const [isSigningOut, startSignOutTransition] = useTransition();
  const [isExporting, startExportTransition] = useTransition();
  const [exportError, setExportError] = useState<string | null>(null);

  const [showDeleteModal, setShowDeleteModal] = useState(false);

  function handleChangeEmail() {
    if (!newEmail) return;
    setEmailStatus('idle');
    setEmailError(null);
    startEmailTransition(async () => {
      const result = await changeEmail(newEmail);
      if (result.error) {
        setEmailStatus('error');
        setEmailError(result.error);
      } else {
        setEmailStatus('sent');
        setNewEmail('');
      }
    });
  }

  function handleSignOutEverywhere() {
    startSignOutTransition(async () => {
      await signOutEverywhere();
    });
  }

  function handleExport() {
    setExportError(null);
    startExportTransition(async () => {
      try {
        const data = await exportUserData();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pathways-data-export-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } catch {
        setExportError('Export failed. Please try again.');
      }
    });
  }

  return (
    <div className="flex-1 overflow-y-auto p-[28px] relative z-10">
      <div style={{ maxWidth: 620, margin: "0 auto" }}>

        {/* Page header */}
        <div className="pw-entry" style={{ marginBottom: 36 }}>
          <p className="pw-eyebrow" style={{ marginBottom: 6 }}>Account</p>
          <h1 style={{ fontFamily: 'var(--pw-font-display)', fontSize: '1.875rem', color: '#0D0D0D', lineHeight: 1.2 }}>
            Settings
          </h1>
        </div>

        {/* ── Email ───────────────────────────────────────────────────── */}
        <SettingsSection title="Email Address">
          <p style={{ fontFamily: 'var(--pw-font-body)', fontSize: 12, color: '#9B9B9B', marginBottom: 4 }}>
            Current address
          </p>
          <p style={{ fontFamily: 'var(--pw-font-body)', fontSize: 14, color: '#0D0D0D', marginBottom: 20 }}>
            {accountData.email}
          </p>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label
                style={{
                  display: 'block',
                  fontFamily: 'var(--pw-font-body)',
                  fontSize: 12,
                  color: '#9B9B9B',
                  marginBottom: 6,
                }}
              >
                New email address
              </label>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="you@example.com"
                disabled={isChangingEmail}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  fontFamily: 'var(--pw-font-body)',
                  fontSize: 14,
                  border: '1px solid rgba(0,0,0,0.15)',
                  borderRadius: 0,
                  outline: 'none',
                  color: '#0D0D0D',
                  background: 'transparent',
                  transition: 'border-color 150ms ease',
                }}
                onFocus={(e) => { (e.target as HTMLInputElement).style.borderColor = '#0D0D0D'; }}
                onBlur={(e) => { (e.target as HTMLInputElement).style.borderColor = 'rgba(0,0,0,0.15)'; }}
              />
            </div>
            <button
              type="button"
              onClick={handleChangeEmail}
              disabled={!newEmail || isChangingEmail}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '9px 20px',
                fontFamily: 'var(--pw-font-ui)',
                fontSize: 13,
                fontWeight: 500,
                color: '#fff',
                background: !newEmail || isChangingEmail ? 'rgba(0,0,0,0.25)' : '#0D0D0D',
                border: 'none',
                borderRadius: 0,
                cursor: !newEmail || isChangingEmail ? 'not-allowed' : 'pointer',
                flexShrink: 0,
                transition: 'background 150ms ease',
              }}
            >
              {isChangingEmail ? 'Sending…' : 'Send verification'}
            </button>
          </div>

          {emailStatus === 'sent' && (
            <p style={{ fontFamily: 'var(--pw-font-body)', fontSize: 13, color: 'var(--pw-success)', marginTop: 10 }}>
              Verification link sent. Check your new inbox to confirm the change.
            </p>
          )}
          {emailStatus === 'error' && emailError && (
            <p style={{ fontFamily: 'var(--pw-font-body)', fontSize: 13, color: 'var(--pw-error)', marginTop: 10 }}>
              {emailError}
            </p>
          )}
        </SettingsSection>

        {/* ── Sessions ────────────────────────────────────────────────── */}
        <SettingsSection title="Sessions">
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontFamily: 'var(--pw-font-body)', fontSize: 12, color: '#9B9B9B', marginBottom: 4 }}>
              Last sign-in
            </p>
            <p style={{ fontFamily: 'var(--pw-font-body)', fontSize: 14, color: '#0D0D0D', marginBottom: 6 }}>
              {formatDate(accountData.lastSignInAt)}
            </p>
            <p style={{ fontFamily: 'var(--pw-font-body)', fontSize: 11, color: '#9B9B9B', lineHeight: 1.5 }}>
              Supabase does not expose a session list — this shows your most recent login across all devices.
            </p>
          </div>
          <GhostButton onClick={handleSignOutEverywhere} disabled={isSigningOut}>
            {isSigningOut ? 'Signing out…' : 'Sign out everywhere'}
          </GhostButton>
        </SettingsSection>

        {/* ── Data export ─────────────────────────────────────────────── */}
        <SettingsSection title="Privacy & Data Export">
          <p style={{ fontFamily: 'var(--pw-font-body)', fontSize: 13, color: '#6B6B6B', lineHeight: 1.6, marginBottom: 16 }}>
            Download a JSON file containing your profile, applications, and document metadata.
            No document files are included — only records.
          </p>
          <GhostButton onClick={handleExport} disabled={isExporting}>
            {isExporting ? 'Preparing export…' : 'Export my data'}
          </GhostButton>
          {exportError && (
            <p style={{ fontFamily: 'var(--pw-font-body)', fontSize: 13, color: 'var(--pw-error)', marginTop: 10 }}>
              {exportError}
            </p>
          )}
        </SettingsSection>

        {/* ── Delete account ───────────────────────────────────────────── */}
        <section style={{ marginTop: 48, paddingTop: 28, borderTop: '1px solid rgba(0,0,0,0.07)' }}>
          <p className="pw-eyebrow" style={{ marginBottom: 14 }}>Danger Zone</p>
          <p style={{ fontFamily: 'var(--pw-font-body)', fontSize: 13, color: '#6B6B6B', lineHeight: 1.6, marginBottom: 20 }}>
            Permanently delete your account and all associated data. This action cannot be undone.
          </p>
          <button
            type="button"
            onClick={() => setShowDeleteModal(true)}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(185,28,28,0.05)';
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--pw-error)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(185,28,28,0.35)';
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '8px 20px',
              fontFamily: 'var(--pw-font-ui)',
              fontSize: 13,
              fontWeight: 500,
              color: 'var(--pw-error)',
              background: 'transparent',
              border: '1px solid rgba(185,28,28,0.35)',
              borderRadius: 0,
              cursor: 'pointer',
              transition: 'background 150ms ease, border-color 150ms ease',
            }}
          >
            Delete my account
          </button>
        </section>

      </div>

      {showDeleteModal && (
        <DeleteModal userEmail={userEmail} onClose={() => setShowDeleteModal(false)} />
      )}
    </div>
  );
}
