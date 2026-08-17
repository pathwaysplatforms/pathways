'use client';

import Link from 'next/link';
import { ChevronRight, Plus, Loader2 } from 'lucide-react';

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
}

interface ApplicationsHomeViewProps {
  status: 'loading' | 'ok' | 'error';
  applications: ApplicationSummary[];
  onSelect: (slug: string) => void;
  onRetry: () => void;
}

/** One application card — pathway name, status, and a mini progress bar. */
function ApplicationCard({ app, onSelect }: { app: ApplicationSummary; onSelect: (slug: string) => void }) {
  const pct = app.totalSteps > 0 ? Math.round((app.completedSteps / app.totalSteps) * 100) : 0;
  return (
    <button
      type="button"
      onClick={() => onSelect(app.pathwaySlug)}
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

/** Applications home — every pathway the user has started, plus a way to add another. */
export function ApplicationsHomeView({ status, applications, onSelect, onRetry }: ApplicationsHomeViewProps) {
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

              <Link
                href="/onboarding/matches"
                className="pw-add-app-card"
                style={{
                  display: 'flex', alignItems: 'center', gap: 14, width: '100%',
                  padding: '22px 24px', textAlign: 'left', textDecoration: 'none',
                  border: `1.5px dashed rgba(26,86,219,0.35)`, borderRadius: CARD_RADIUS,
                  transition: 'background 120ms ease',
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
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
