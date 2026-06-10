'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import type { ReactNode } from 'react';
import { ExternalLink, FileText, Shield, Clock, X, Copy, Check, Loader2 } from 'lucide-react';
import { updateStepProgress } from '@/app/actions/progress';
import { getEmailTemplates, resolveTemplate } from '@/lib/email-templates';
import { documentBelongsToStep } from '@/lib/step-document-map';
import type { EnrichedApplicationStep, DashboardDocument, ProfileContext, StepResource } from '@/modules/dashboard/types';

const ink = '#0A0A0A';
const muted = '#6B7280';
const border = '#E5E5E5';
const accent = '#1A56DB';
const surface = '#F7F7F5';

const font = { body: 'var(--pw-font-body)' as const };

// ── Shared primitives ─────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p style={{
      fontFamily: font.body,
      fontSize: 10,
      fontWeight: 600,
      letterSpacing: '0.12em',
      color: '#9CA3AF',
      textTransform: 'uppercase',
      margin: '0 0 12px',
    }}>
      {children}
    </p>
  );
}

function SectionDivider() {
  return <hr style={{ border: 'none', borderTop: `1px solid ${border}`, margin: '16px 0 0' }} />;
}

function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };
  return (
    <button
      onClick={handleCopy}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '6px 14px', borderRadius: 9999, border: `1px solid ${border}`,
        background: copied ? '#F0FDF4' : '#FFFFFF',
        color: copied ? '#16A34A' : ink,
        fontFamily: font.body, fontSize: 12, fontWeight: 500,
        cursor: 'pointer',
      }}
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? 'Copied ✓' : label}
    </button>
  );
}

function HighlightedText({ text }: { text: string }) {
  const parts = text.split(/(\{\{[A-Z0-9_]+\}\})/g);
  return (
    <>
      {parts.map((part, i) =>
        /^\{\{[A-Z0-9_]+\}\}$/.test(part) ? (
          <mark key={i} style={{ background: '#FEF3C7', borderRadius: 3, padding: '0 2px' }}>{part}</mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

// ── Section A — Documents ─────────────────────────────────────────────────────

function DocumentsSection({ stepDocs }: { stepDocs: DashboardDocument[] }) {
  return (
    <div>
      {stepDocs.map((doc) => (
        <div
          key={doc.id}
          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0' }}
        >
          {doc.isMandatory ? (
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: ink, flexShrink: 0, display: 'inline-block' }} />
          ) : (
            <span style={{ width: 10, height: 10, borderRadius: '50%', border: `1.5px solid ${muted}`, flexShrink: 0, display: 'inline-block' }} />
          )}
          <span style={{ fontFamily: font.body, fontSize: 13, color: ink, flex: 1, minWidth: 0 }}>
            {doc.name}
          </span>
          {!doc.isMandatory && (
            <span style={{ fontFamily: font.body, fontSize: 11, color: muted, flexShrink: 0 }}>
              (optional)
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Section B — Resources ─────────────────────────────────────────────────────

function ResourcesSection({ resources }: { resources: StepResource[] }) {
  return (
    <div>
      {resources.map((r, i) => (
        <a
          key={i}
          href={r.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 8px', borderRadius: 6, textDecoration: 'none', cursor: 'pointer',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = '#F9FAFB'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = 'transparent'; }}
        >
          {r.type === 'form' ? (
            <FileText size={14} style={{ color: muted, flexShrink: 0 }} />
          ) : r.type === 'official' ? (
            <Shield size={14} style={{ color: accent, flexShrink: 0 }} />
          ) : (
            <ExternalLink size={14} style={{ color: muted, flexShrink: 0 }} />
          )}
          <span style={{ fontFamily: font.body, fontSize: 13, color: ink, flex: 1, minWidth: 0 }}>
            {r.label}
          </span>
          {r.type === 'form' && (
            <span style={{
              display: 'inline-block', padding: '1px 7px', borderRadius: 9999,
              background: '#FFFBEB', color: '#92400E',
              fontFamily: font.body, fontSize: 10, fontWeight: 500, letterSpacing: '0.04em', flexShrink: 0,
            }}>
              Form
            </span>
          )}
        </a>
      ))}
    </div>
  );
}

// ── Section C — Email Templates ───────────────────────────────────────────────

function EmailTemplatesSection({
  pathwaySlug,
  stepNumber,
  profileContext,
}: {
  pathwaySlug: string;
  stepNumber: number;
  profileContext: ProfileContext;
}) {
  const templates = getEmailTemplates(pathwaySlug, stepNumber);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {templates.map((tmpl, i) => {
        const resolvedSubject = resolveTemplate(tmpl.subject, profileContext);
        const resolvedBody = resolveTemplate(tmpl.body, profileContext);
        const clipboardText = `Subject: ${resolvedSubject}\n\n${resolvedBody}`;

        return (
          <div key={i} style={{ border: `1px solid ${border}`, borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', borderBottom: `1px solid ${border}`, background: surface }}>
              <p style={{ fontFamily: font.body, fontSize: 11, color: muted, margin: '0 0 2px', fontStyle: 'italic' }}>
                ✉ Send to: {tmpl.recipientHint}
              </p>
              <p style={{ fontFamily: font.body, fontSize: 13, fontWeight: 500, color: ink, margin: 0 }}>
                <HighlightedText text={resolvedSubject} />
              </p>
            </div>
            <div style={{ padding: 14 }}>
              <pre style={{
                fontFamily: font.body, fontSize: 12, color: ink,
                whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: '0 0 12px', lineHeight: 1.7,
              }}>
                <HighlightedText text={resolvedBody} />
              </pre>
              <CopyButton text={clipboardText} label="Copy email" />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Section D — Cover Letter ──────────────────────────────────────────────────

function CoverLetterSection({ step, pathwaySlug }: {
  step: EnrichedApplicationStep;
  pathwaySlug: string | null;
}) {
  const [letter, setLetter] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/cover-letter/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stepId: step.id }),
      });
      const data = (await res.json()) as { letter?: string; error?: { message: string } };
      if (!res.ok || data.error) {
        setError(data.error?.message ?? 'Generation failed. Please try again.');
      } else if (data.letter) {
        setLetter(data.letter);
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div style={{
        padding: '8px 12px', borderRadius: 6,
        background: '#FFFBEB', border: '1px solid #FDE68A', marginBottom: 16,
      }}>
        <p style={{ fontFamily: font.body, fontSize: 12, color: '#92400E', margin: 0 }}>
          AI-generated first draft · Review before submitting
        </p>
      </div>

      {!letter && (
        <button
          onClick={generate}
          disabled={loading || !pathwaySlug}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '10px 20px', borderRadius: 9999,
            background: loading ? '#E5E7EB' : ink,
            color: loading ? muted : '#FFFFFF',
            fontFamily: font.body, fontSize: 13, fontWeight: 500,
            border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
            marginBottom: 16,
          }}
        >
          {loading && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
          {loading ? 'Writing your letter...' : 'Generate Cover Letter'}
        </button>
      )}

      {error && (
        <p style={{ fontFamily: font.body, fontSize: 13, color: '#DC2626', marginBottom: 12 }}>{error}</p>
      )}

      {letter && (
        <div style={{ border: `1px solid ${border}`, borderRadius: 10, overflow: 'hidden', marginBottom: 16 }}>
          <div style={{ padding: 16 }}>
            <pre style={{
              fontFamily: 'Georgia, serif', fontSize: 13, color: ink,
              whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: '0 0 14px', lineHeight: 1.8,
            }}>
              <HighlightedText text={letter} />
            </pre>
            <div style={{ display: 'flex', gap: 8 }}>
              <CopyButton text={letter} label="Copy letter" />
              <button
                onClick={generate}
                disabled={loading}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '6px 14px', borderRadius: 9999,
                  border: `1px solid ${border}`, background: '#FFFFFF', color: ink,
                  fontFamily: font.body, fontSize: 12, fontWeight: 500,
                  cursor: loading ? 'not-allowed' : 'pointer',
                }}
              >
                {loading && <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />}
                {loading ? 'Regenerating...' : 'Regenerate'}
              </button>
            </div>
          </div>
        </div>
      )}

      <p style={{ fontFamily: font.body, fontSize: 11, color: muted, fontStyle: 'italic' }}>
        General guidance only · Not legal advice
      </p>
    </div>
  );
}

// ── Main drawer ───────────────────────────────────────────────────────────────

interface StepDetailDrawerProps {
  step: EnrichedApplicationStep;
  documents: DashboardDocument[];
  pathwaySlug: string | null;
  applicationId: string | null;
  profileContext: ProfileContext | null;
  onClose: () => void;
}

/** Slide-in right drawer showing step details in a single scrollable panel. */
export function StepDetailDrawer({
  step,
  documents,
  pathwaySlug,
  profileContext,
  onClose,
}: StepDetailDrawerProps) {
  const [visible, setVisible] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [markedComplete, setMarkedComplete] = useState(step.status === 'complete');
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    setMarkedComplete(step.status === 'complete');
  }, [step.id, step.status]);

  const handleClose = () => {
    setVisible(false);
    closeTimerRef.current = setTimeout(onClose, 310);
  };

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  const handleMarkComplete = () => {
    if (!pathwaySlug) return;
    startTransition(async () => {
      await updateStepProgress({ stepId: step.id, pathwaySlug, status: 'complete' });
      setMarkedComplete(true);
    });
  };

  const statusStyles: Record<EnrichedApplicationStep['status'], { bg: string; color: string; label: string }> = {
    upcoming: { bg: '#F3F4F6', color: muted,      label: 'Upcoming' },
    current:  { bg: '#EFF6FF', color: accent,     label: 'In Progress' },
    complete: { bg: '#F0FDF4', color: '#16A34A',  label: 'Complete' },
  };
  const ss = statusStyles[markedComplete ? 'complete' : step.status];

  // Pre-compute section visibility
  const stepDocs = documents.filter((d) => documentBelongsToStep(d.name, step.stepNumber));
  const hasDocuments  = stepDocs.length > 0;
  const hasResources  = (step.resources?.length ?? 0) > 0;
  const templates     = pathwaySlug && profileContext ? getEmailTemplates(pathwaySlug, step.stepNumber) : [];
  const hasTemplates  = templates.length > 0;
  const showCoverLetter = step.stepNumber >= 3 && step.stepNumber <= 5;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={handleClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.20)', zIndex: 39,
          opacity: visible ? 1 : 0,
          transition: 'opacity 300ms cubic-bezier(0.16,1,0.3,1)',
        }}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Step details: ${step.label}`}
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0,
          width: 'min(480px, 100vw)',
          background: '#FFFFFF',
          borderLeft: `1px solid ${border}`,
          zIndex: 40,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          transform: visible ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 300ms cubic-bezier(0.16,1,0.3,1)',
        }}
      >
        {/* Header — sticky */}
        <div style={{
          padding: '20px 24px 16px',
          borderBottom: `1px solid #E5E7EB`,
          flexShrink: 0,
          background: '#FFFFFF',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 24, height: 24, borderRadius: '50%',
                background: '#F3F4F6', color: muted,
                fontFamily: font.body, fontSize: 11, fontWeight: 500, flexShrink: 0,
              }}>
                {step.stepNumber}
              </span>
              <h2 style={{
                fontFamily: 'var(--pw-font-display)', fontSize: 17, fontWeight: 400,
                color: ink, margin: 0, lineHeight: 1.3,
              }}>
                {step.label}
              </h2>
            </div>
            <button
              onClick={handleClose}
              aria-label="Close drawer"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 28, height: 28, borderRadius: '50%',
                border: `1px solid ${border}`, background: '#FFFFFF',
                cursor: 'pointer', flexShrink: 0,
              }}
            >
              <X size={14} color={muted} />
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{
              display: 'inline-block', padding: '2px 10px', borderRadius: 9999,
              background: ss.bg, color: ss.color,
              fontFamily: font.body, fontSize: 11, fontWeight: 500,
              letterSpacing: '0.05em', textTransform: 'uppercase',
            }}>
              {ss.label}
            </span>
            {step.estimatedDuration && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: font.body, fontSize: 12, color: muted }}>
                <Clock size={12} />
                {step.estimatedDuration}
              </span>
            )}
          </div>

          {step.description && (
            <p style={{ fontFamily: font.body, fontSize: 13, color: '#374151', margin: '10px 0 0', lineHeight: 1.6 }}>
              {step.description}
            </p>
          )}
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '0 24px 8px' }}>

          {hasDocuments && (
            <div style={{ paddingTop: 20, paddingBottom: 16 }}>
              <SectionLabel>Documents Needed</SectionLabel>
              <DocumentsSection stepDocs={stepDocs} />
              <SectionDivider />
            </div>
          )}

          {hasResources && step.resources && (
            <div style={{ paddingTop: 20, paddingBottom: 16 }}>
              <SectionLabel>Official Resources</SectionLabel>
              <ResourcesSection resources={step.resources} />
              <SectionDivider />
            </div>
          )}

          {hasTemplates && pathwaySlug && profileContext && (
            <div style={{ paddingTop: 20, paddingBottom: 16 }}>
              <SectionLabel>Email Templates</SectionLabel>
              <EmailTemplatesSection
                pathwaySlug={pathwaySlug}
                stepNumber={step.stepNumber}
                profileContext={profileContext}
              />
              <SectionDivider />
            </div>
          )}

          {showCoverLetter && (
            <div style={{ paddingTop: 20, paddingBottom: 16 }}>
              <SectionLabel>Cover Letter</SectionLabel>
              <CoverLetterSection step={step} pathwaySlug={pathwaySlug} />
            </div>
          )}

        </div>

        {/* Footer — sticky */}
        <div style={{
          padding: '12px 24px',
          borderTop: `1px solid ${border}`,
          flexShrink: 0,
          background: '#FFFFFF',
        }}>
          {markedComplete ? (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 16px', borderRadius: 9999,
              background: '#F0FDF4', color: '#16A34A',
              fontFamily: font.body, fontSize: 13, fontWeight: 500,
            }}>
              <Check size={14} />
              Completed ✓
            </div>
          ) : (
            <button
              onClick={handleMarkComplete}
              disabled={isPending || !pathwaySlug}
              style={{
                width: '100%',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '10px 20px', borderRadius: 9999,
                background: isPending ? '#E5E7EB' : ink,
                color: isPending ? muted : '#FFFFFF',
                fontFamily: font.body, fontSize: 13, fontWeight: 500,
                border: 'none', cursor: isPending ? 'not-allowed' : 'pointer',
              }}
            >
              {isPending && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
              {isPending ? 'Saving...' : 'Mark as complete →'}
            </button>
          )}
        </div>
      </div>

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </>
  );
}
