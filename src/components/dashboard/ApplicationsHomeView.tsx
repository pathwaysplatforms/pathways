'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Plus, Loader2, X, UserPlus, Repeat } from 'lucide-react';
import { addCoApplicant } from '@/app/actions/co-applicant';

// ── Local design tokens — mirrors ApplicationPageClient.tsx's palette so the
// applications-home screen (no sidebar) reads as the same page family. ──────
const INK = '#0A0A0A';
const MUTED = '#6B7280';
const BORDER = '1px solid rgba(0,0,0,0.30)';
const TEXT_TERTIARY = '#9CA3AF';
const ACCENT = '#1A56DB';
const ACCENT_TINT = 'rgba(26,86,219,0.08)';
const PROGRESS_TEAL = '#0E7BA6';
const CARD_RADIUS = 16;
const PILL = 999;
const font = { body: 'var(--pw-font-body)' as const, display: 'var(--pw-font-display)' as const };

export interface ApplicationSummary {
  applicationId: string;
  pathwaySlug: string;
  pathwayTitle: string;
  pathwayOfficialName: string | null;
  processingTime: string;
  status: string;
  completedSteps: number;
  totalSteps: number;
  profileId: string;
  personName: string;
}

interface ApplicationsHomeViewProps {
  status: 'loading' | 'ok' | 'error';
  applications: ApplicationSummary[];
  onSelect: (applicationId: string) => void;
  onRetry: () => void;
}

/** One application card — pathway name, status, and a mini progress bar. */
function ApplicationCard({ app, onSelect }: { app: ApplicationSummary; onSelect: (applicationId: string) => void }) {
  const pct = app.totalSteps > 0 ? Math.round((app.completedSteps / app.totalSteps) * 100) : 0;
  return (
    <button
      type="button"
      onClick={() => onSelect(app.applicationId)}
      className="pw-app-card"
      style={{
        display: 'flex', alignItems: 'center', gap: 20, width: '100%',
        padding: '22px 24px', textAlign: 'left', cursor: 'pointer',
        border: BORDER, borderRadius: CARD_RADIUS, background: '#FFFFFF',
        transition: 'background 120ms ease',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <h3 style={{ fontFamily: font.display, fontSize: 18, fontWeight: 500, color: INK, margin: 0 }}>
            {app.pathwayTitle}
          </h3>
          <span style={{
            display: 'inline-block', padding: '3px 10px', borderRadius: PILL,
            background: '#F5F4F8', color: MUTED, fontFamily: font.body, fontSize: 10,
            fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', flexShrink: 0,
          }}>
            {app.status}
          </span>
          {app.personName !== 'You' && (
            <span style={{
              display: 'inline-block', padding: '3px 10px', borderRadius: PILL,
              background: ACCENT_TINT, color: ACCENT, fontFamily: font.body, fontSize: 10,
              fontWeight: 600, letterSpacing: '0.02em', flexShrink: 0,
            }}>
              {app.personName}
            </span>
          )}
        </div>
        {app.pathwayOfficialName && (
          <p style={{ fontFamily: font.body, fontSize: 13, color: MUTED, margin: '0 0 14px' }}>
            {app.pathwayOfficialName}
          </p>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, maxWidth: 320, height: 7, borderRadius: PILL, background: '#EEEDF2', overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${pct}%`, borderRadius: PILL,
              background: pct === 100 ? '#16A34A' : PROGRESS_TEAL,
              transition: 'width 400ms ease',
            }} />
          </div>
          <span style={{ fontFamily: font.body, fontSize: 12, color: MUTED, whiteSpace: 'nowrap', flexShrink: 0 }}>
            {app.completedSteps} of {app.totalSteps} steps · {app.processingTime}
          </span>
        </div>
      </div>
      <ChevronRight size={18} color={TEXT_TERTIARY} style={{ flexShrink: 0 }} />
    </button>
  );
}

type ChooserView = 'choice' | 'co-applicant-form' | 'co-applicant-success';

const inputStyle: React.CSSProperties = {
  width: '100%', height: 42, padding: '0 14px', borderRadius: 10,
  border: '1px solid rgba(0,0,0,0.18)', fontFamily: font.body, fontSize: 14,
  color: INK, outline: 'none',
};

/** Modal offering the two "add another application" paths: same profile, or a new co-applicant. */
function AddApplicationChooser({ onClose }: { onClose: () => void }) {
  const [view, setView] = useState<ChooserView>('choice');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdName, setCreatedName] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim() || !email.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await addCoApplicant({ fullName: fullName.trim(), email: email.trim() });
      setCreatedName(result.fullName ?? fullName.trim());
      setView('co-applicant-success');
    } catch {
      setError("We couldn't add that person. Please check the details and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed', inset: 0, zIndex: 50, display: 'flex',
        alignItems: 'center', justifyContent: 'center', padding: 16,
        background: 'rgba(10,10,10,0.45)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          position: 'relative', width: '100%', maxWidth: 440, background: '#FFFFFF',
          borderRadius: CARD_RADIUS, padding: 32, border: BORDER,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            position: 'absolute', top: 18, right: 18, border: 'none', background: 'none',
            cursor: 'pointer', color: TEXT_TERTIARY, display: 'flex',
          }}
        >
          <X size={18} />
        </button>

        {view === 'choice' && (
          <>
            <h2 style={{ fontFamily: font.display, fontSize: 22, fontWeight: 500, color: INK, margin: '0 0 6px' }}>
              Add another application
            </h2>
            <p style={{ fontFamily: font.body, fontSize: 14, color: MUTED, margin: '0 0 24px' }}>
              Who is this application for?
            </p>

            <Link
              href="/onboarding/matches"
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 14, width: '100%',
                padding: '16px 18px', textAlign: 'left', textDecoration: 'none',
                border: BORDER, borderRadius: 12, marginBottom: 12,
              }}
            >
              <Repeat size={18} color={ACCENT} style={{ flexShrink: 0, marginTop: 2 }} />
              <span>
                <span style={{ display: 'block', fontFamily: font.body, fontSize: 14, fontWeight: 600, color: INK }}>
                  Apply with my own profile
                </span>
                <span style={{ display: 'block', fontFamily: font.body, fontSize: 13, color: MUTED, marginTop: 2 }}>
                  Start a new pathway using the details you already gave us.
                </span>
              </span>
            </Link>

            <button
              type="button"
              onClick={() => setView('co-applicant-form')}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 14, width: '100%',
                padding: '16px 18px', textAlign: 'left', cursor: 'pointer',
                border: BORDER, borderRadius: 12, background: 'none',
              }}
            >
              <UserPlus size={18} color={ACCENT} style={{ flexShrink: 0, marginTop: 2 }} />
              <span>
                <span style={{ display: 'block', fontFamily: font.body, fontSize: 14, fontWeight: 600, color: INK }}>
                  Add a co-applicant
                </span>
                <span style={{ display: 'block', fontFamily: font.body, fontSize: 13, color: MUTED, marginTop: 2 }}>
                  Apply on behalf of family or a friend, from your account.
                </span>
              </span>
            </button>
          </>
        )}

        {view === 'co-applicant-form' && (
          <>
            <button
              type="button"
              onClick={() => setView('choice')}
              style={{
                border: 'none', background: 'none', cursor: 'pointer', padding: 0,
                fontFamily: font.body, fontSize: 12, color: MUTED, marginBottom: 16,
              }}
            >
              ← Back
            </button>
            <h2 style={{ fontFamily: font.display, fontSize: 22, fontWeight: 500, color: INK, margin: '0 0 6px' }}>
              Add a co-applicant
            </h2>
            <p style={{ fontFamily: font.body, fontSize: 14, color: MUTED, margin: '0 0 20px' }}>
              We&apos;ll create their profile. You&apos;ll manage their application from your account.
            </p>

            {error && (
              <p style={{ fontFamily: font.body, fontSize: 13, color: '#B91C1C', margin: '0 0 14px' }}>
                {error}
              </p>
            )}

            <form onSubmit={(e) => void handleSubmit(e)}>
              <label style={{ display: 'block', fontFamily: font.body, fontSize: 12, fontWeight: 600, color: MUTED, marginBottom: 6 }}>
                Full name
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Jamie Lee"
                style={{ ...inputStyle, marginBottom: 16 }}
              />

              <label style={{ display: 'block', fontFamily: font.body, fontSize: 12, fontWeight: 600, color: MUTED, marginBottom: 6 }}>
                Contact email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jamie@example.com"
                style={{ ...inputStyle, marginBottom: 24 }}
              />

              <button
                type="submit"
                disabled={submitting || !fullName.trim() || !email.trim()}
                style={{
                  width: '100%', padding: '12px 0', fontFamily: font.body, fontSize: 14,
                  fontWeight: 600, color: '#fff', background: INK, borderRadius: PILL,
                  border: 'none', cursor: submitting ? 'default' : 'pointer',
                  opacity: submitting ? 0.6 : 1,
                }}
              >
                {submitting ? 'Adding…' : 'Add co-applicant'}
              </button>
            </form>
          </>
        )}

        {view === 'co-applicant-success' && (
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <h2 style={{ fontFamily: font.display, fontSize: 22, fontWeight: 500, color: INK, margin: '0 0 8px' }}>
              {createdName} has been added
            </h2>
            <p style={{ fontFamily: font.body, fontSize: 14, color: MUTED, margin: '0 0 24px' }}>
              Their profile is saved to your account. Starting their onboarding and pathway match is coming soon —
              we&apos;ll let you know as soon as it&apos;s ready.
            </p>
            <button
              type="button"
              onClick={onClose}
              style={{
                display: 'inline-flex', alignItems: 'center', padding: '10px 24px',
                fontFamily: font.body, fontSize: 13, fontWeight: 600, color: '#fff',
                background: INK, borderRadius: PILL, border: 'none', cursor: 'pointer',
              }}
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Applications home — every pathway the user has started, plus a way to add another. */
export function ApplicationsHomeView({ status, applications, onSelect, onRetry }: ApplicationsHomeViewProps) {
  const [chooserOpen, setChooserOpen] = useState(false);

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#FFFFFF' }}>
      <style>{`
        .pw-app-card:hover { background: #FAFAFB; }
        .pw-add-app-card:hover { background: ${ACCENT_TINT}; }
      `}</style>
      <div className="pw-scroll" style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ maxWidth: 860, padding: '48px 48px 80px 72px' }}>
          <h1 style={{ fontFamily: font.display, fontSize: 34, fontWeight: 400, color: INK, margin: '0 0 8px', letterSpacing: '-0.01em' }}>
            Your applications
          </h1>
          <p style={{ fontFamily: font.body, fontSize: 15, color: MUTED, margin: '0 0 32px' }}>
            Pick up where you left off, or start a new pathway.
          </p>

          {status === 'loading' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '40px 0', color: MUTED }}>
              <Loader2 size={16} style={{ animation: 'spin 0.8s linear infinite' }} />
              <span style={{ fontFamily: font.body, fontSize: 14 }}>Loading your applications…</span>
            </div>
          )}

          {status === 'error' && (
            <div style={{ padding: '32px 0' }}>
              <p style={{ fontFamily: font.body, fontSize: 14, color: MUTED, margin: '0 0 14px' }}>
                We couldn&apos;t load your applications. Please try again.
              </p>
              <button
                type="button"
                onClick={onRetry}
                style={{
                  display: 'inline-flex', alignItems: 'center', padding: '10px 22px',
                  fontFamily: font.body, fontSize: 13, fontWeight: 600, color: '#fff',
                  background: INK, borderRadius: PILL, border: 'none', cursor: 'pointer',
                }}
              >
                Retry
              </button>
            </div>
          )}

          {status === 'ok' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {applications.map((app) => (
                <ApplicationCard key={app.applicationId} app={app} onSelect={onSelect} />
              ))}

              <button
                type="button"
                onClick={() => setChooserOpen(true)}
                className="pw-add-app-card"
                style={{
                  display: 'flex', alignItems: 'center', gap: 14, width: '100%',
                  padding: '22px 24px', textAlign: 'left', cursor: 'pointer',
                  border: `1.5px dashed rgba(26,86,219,0.35)`, borderRadius: CARD_RADIUS,
                  background: 'none', transition: 'background 120ms ease',
                }}
              >
                <div style={{
                  width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                  border: `1.5px solid ${ACCENT}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Plus size={16} color={ACCENT} />
                </div>
                <span style={{ fontFamily: font.body, fontSize: 15, fontWeight: 600, color: ACCENT }}>
                  Add another application
                </span>
              </button>
            </div>
          )}
        </div>
      </div>

      {chooserOpen && <AddApplicationChooser onClose={() => setChooserOpen(false)} />}
    </div>
  );
}
