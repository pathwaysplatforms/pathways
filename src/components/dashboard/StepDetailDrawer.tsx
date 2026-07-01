'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';
import { ExternalLink, FileText, Shield, Clock, X, Copy, Check, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { updateStepProgress } from '@/app/actions/progress';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { getEmailTemplates, resolveTemplate } from '@/lib/email-templates';
import { documentBelongsToStep } from '@/lib/step-document-map';
import { CheckmarkDraw } from '@/components/fx/CheckmarkDraw';
import { ParticleBurst } from '@/components/fx/ParticleBurst';
import type { EnrichedApplicationStep, DashboardDocument, ProfileContext, StepResource } from '@/modules/dashboard/types';
import { registerChecklistFlush } from '@/lib/checklist-flush-registry';

const ink = '#0A0A0A';
const muted = '#6B7280';
const border = '#E5E5E5';
const accent = '#1A56DB';
const surface = '#F7F7F5';

const font = { body: 'var(--pw-font-body)' as const };

// ── Shared primitives ─────────────────────────────────────────────────────────

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="pw-eyebrow" style={{ margin: '0 0 12px' }}>
      {children}
    </p>
  );
}

export function SectionDivider() {
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
        padding: '6px 14px', borderRadius: 8, border: `1px solid ${border}`,
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

// ── Section — Checklist items ─────────────────────────────────────────────────

export function ChecklistSection({ stepId, items }: { stepId: string; items: string[] }) {
  const [open, setOpen] = useState(true);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [hydrating, setHydrating] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Proxy refs — stable registration, always calls latest flush logic.
  const checkedRef = useRef<Set<number>>(new Set());
  checkedRef.current = checked;
  const flushFnRef = useRef<() => void>(() => {});
  flushFnRef.current = () => {
    if (debounceRef.current === null) return;
    clearTimeout(debounceRef.current);
    debounceRef.current = null;
    void (async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        await (supabase as ReturnType<typeof createSupabaseBrowserClient>)
          .from('step_checklist_progress' as never)
          .upsert(
            { user_id: user.id, step_id: stepId, checked_items: [...checkedRef.current], updated_at: new Date().toISOString() } as never,
            { onConflict: 'user_id,step_id' },
          );
      } catch { /* silently fail */ }
    })();
  };

  useEffect(() => {
    const fn = () => flushFnRef.current();
    return registerChecklistFlush(fn);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || cancelled) return;

        // step_checklist_progress is a new table not yet in generated types; cast via never.
        const { data } = await (supabase as ReturnType<typeof createSupabaseBrowserClient>)
          .from('step_checklist_progress' as never)
          .select('checked_items')
          .eq('user_id', user.id)
          .eq('step_id', stepId)
          .maybeSingle() as unknown as { data: { checked_items: number[] } | null };

        if (!cancelled && data && Array.isArray(data.checked_items)) {
          setChecked(new Set(data.checked_items));
        }
      } catch {
        // Non-fatal — fall through to empty state
      } finally {
        if (!cancelled) setHydrating(false);
      }
    })();
    return () => {
      cancelled = true;
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [stepId]);

  const persist = (nextChecked: Set<number>) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        await (supabase as ReturnType<typeof createSupabaseBrowserClient>)
          .from('step_checklist_progress' as never)
          // Payload cast to never because the table is not yet in the generated Database type.
          .upsert(
            { user_id: user.id, step_id: stepId, checked_items: [...nextChecked], updated_at: new Date().toISOString() } as never,
            { onConflict: 'user_id,step_id' }
          );
      } catch {
        // Silently fail — checklist state is low-stakes
      }
    }, 600);
  };

  const toggle = (i: number) => {
    const next = new Set(checked);
    next.has(i) ? next.delete(i) : next.add(i);
    setChecked(next);
    persist(next);
  };

  if (hydrating) {
    return (
      <div style={{
        height: 16, borderRadius: 4,
        background: 'linear-gradient(90deg, #F3F4F6 25%, #E5E7EB 50%, #F3F4F6 75%)',
        backgroundSize: '200% 100%',
        animation: 'pw-shimmer 1.4s ease infinite',
      }} />
    );
  }

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          width: '100%', background: 'none', border: 'none', cursor: 'pointer',
          padding: 0, marginBottom: open ? 10 : 0,
        }}
        aria-expanded={open}
      >
        <span style={{ fontFamily: font.body, fontSize: 12, color: muted }}>
          {checked.size}/{items.length} done
        </span>
        {open ? <ChevronUp size={14} color={muted} /> : <ChevronDown size={14} color={muted} />}
      </button>

      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map((item, i) => {
            const done = checked.has(i);
            return (
              <label
                key={i}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  cursor: 'pointer', padding: '6px 0',
                }}
              >
                <input
                  type="checkbox"
                  checked={done}
                  onChange={() => toggle(i)}
                  style={{ marginTop: 2, accentColor: accent, flexShrink: 0, width: 14, height: 14 }}
                />
                <span style={{
                  fontFamily: font.body, fontSize: 13, color: done ? muted : ink,
                  textDecoration: done ? 'line-through' : 'none',
                  lineHeight: 1.5,
                }}>
                  {item}
                </span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Section — Pro tips ────────────────────────────────────────────────────────

export function ProTipsSection({ tip }: { tip: string }) {
  return (
    <div style={{
      padding: '12px 14px',
      borderRadius: 8,
      background: '#FFFBEB',
      border: '1px solid #FDE68A',
    }}>
      <p style={{
        fontFamily: font.body, fontSize: 12, color: '#92400E',
        margin: 0, lineHeight: 1.6,
      }}>
        {tip}
      </p>
    </div>
  );
}

// ── Section A — Documents ─────────────────────────────────────────────────────

export function DocumentsSection({ stepDocs }: { stepDocs: DashboardDocument[] }) {
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

export function ResourcesSection({ resources }: { resources: StepResource[] }) {
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

export function EmailTemplatesSection({
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

export function CoverLetterSection({ step, pathwaySlug }: {
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
            padding: '9px 20px', borderRadius: 8,
            background: 'transparent',
            color: loading ? muted : ink,
            border: `1px solid ${loading ? border : ink}`,
            fontFamily: font.body, fontSize: 13, fontWeight: 500,
            cursor: loading ? 'not-allowed' : 'pointer',
            marginBottom: 16, transition: 'background 120ms ease, color 120ms ease',
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
                  padding: '6px 14px', borderRadius: 8,
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
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Portal target (document.body) is only available on the client after mount.
  useEffect(() => setMounted(true), []);
  const [markedComplete, setMarkedComplete] = useState(step.status === 'complete');
  const [justCompleted, setJustCompleted] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    setMarkedComplete(step.status === 'complete');
    setJustCompleted(false);
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  // Re-registers when visible changes so handleClose captures the current timer ref
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const handleMarkComplete = () => {
    if (!pathwaySlug) return;
    setActionError(null);
    startTransition(async () => {
      try {
        await updateStepProgress({ stepId: step.id, pathwaySlug, status: 'complete' });
        setMarkedComplete(true);
        setJustCompleted(true);
        closeTimerRef.current = setTimeout(handleClose, 1500);
      } catch {
        setActionError('Failed to save. Please try again.');
      }
    });
  };

  const handleMarkIncomplete = () => {
    if (!pathwaySlug) return;
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setActionError(null);
    startTransition(async () => {
      try {
        await updateStepProgress({ stepId: step.id, pathwaySlug, status: 'upcoming' });
        setMarkedComplete(false);
        setJustCompleted(false);
      } catch {
        setActionError('Failed to save. Please try again.');
      }
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
  const hasChecklist  = (step.checklistItems?.length ?? 0) > 0;
  const hasProTips    = !!step.proTips;
  const hasOfficialUrl = !!step.officialUrl;

  if (!mounted) return null;

  return createPortal(
    <>
      {/* Backdrop — dims + blurs everything behind the modal */}
      <div
        onClick={handleClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.40)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          zIndex: 299,
          opacity: visible ? 1 : 0,
          transition: 'opacity 300ms cubic-bezier(0.16,1,0.3,1)',
        }}
        aria-hidden="true"
      />

      {/* Centered modal panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Step details: ${step.label}`}
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          width: 'min(560px, calc(100vw - 32px))',
          maxHeight: 'min(720px, calc(100vh - 64px))',
          background: '#FFFFFF',
          border: `1px solid ${border}`,
          borderRadius: 20,
          boxShadow: 'var(--shadow-card-lg)',
          zIndex: 300,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          transform: visible
            ? 'translate(-50%, -50%) scale(1)'
            : 'translate(-50%, -50%) scale(0.96)',
          opacity: visible ? 1 : 0,
          transition: 'transform 300ms cubic-bezier(0.16,1,0.3,1), opacity 300ms cubic-bezier(0.16,1,0.3,1)',
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
              aria-label="Close"
              className="pw-interactive"
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

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
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
            {(step.estimatedDaysMin != null || step.estimatedDaysMax != null) && (
              <span style={{
                display: 'inline-block', padding: '2px 8px', borderRadius: 9999,
                border: `1px solid ${border}`, background: '#FFFFFF',
                fontFamily: font.body, fontSize: 11, color: muted,
              }}>
                Est. {step.estimatedDaysMin != null && step.estimatedDaysMax != null
                  ? `${step.estimatedDaysMin}–${step.estimatedDaysMax} days`
                  : step.estimatedDaysMin != null
                    ? `${step.estimatedDaysMin}+ days`
                    : `up to ${step.estimatedDaysMax} days`}
              </span>
            )}
            {step.feeCad != null && (
              <span style={{
                display: 'inline-block', padding: '2px 8px', borderRadius: 9999,
                border: `1px solid ${border}`, background: '#FFFFFF',
                fontFamily: font.body, fontSize: 11, color: muted,
              }}>
                Est. fee: ${step.feeCad} CAD
              </span>
            )}
            {step.formNumbers != null && step.formNumbers.length > 0 && step.formNumbers.map((f) => (
              <span key={f} style={{
                display: 'inline-block', padding: '2px 8px', borderRadius: 9999,
                border: `1px solid ${border}`, background: '#F9FAFB',
                fontFamily: font.body, fontSize: 11, color: muted,
              }}>
                {f}
              </span>
            ))}
          </div>

          {step.description && (
            <p style={{ fontFamily: font.body, fontSize: 13, color: '#374151', margin: '10px 0 0', lineHeight: 1.6 }}>
              {step.description}
            </p>
          )}
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '0 24px 8px' }}>

          {hasChecklist && step.checklistItems && (
            <div style={{ paddingTop: 20, paddingBottom: 16 }}>
              <SectionLabel>Checklist</SectionLabel>
              <ChecklistSection stepId={step.id} items={step.checklistItems} />
              <SectionDivider />
            </div>
          )}

          {hasProTips && step.proTips && (
            <div style={{ paddingTop: 20, paddingBottom: 16 }}>
              <SectionLabel>Pro Tip</SectionLabel>
              <ProTipsSection tip={step.proTips} />
              <SectionDivider />
            </div>
          )}

          {hasOfficialUrl && step.officialUrl && (
            <div style={{ paddingTop: 20, paddingBottom: 16 }}>
              <a
                href={step.officialUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '8px 16px', borderRadius: 8,
                  border: `1px solid ${border}`, background: '#FFFFFF',
                  fontFamily: font.body, fontSize: 13, color: ink,
                  textDecoration: 'none', fontWeight: 500,
                }}
              >
                <ExternalLink size={13} />
                Official source →
              </a>
              <SectionDivider />
            </div>
          )}

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
          {actionError && (
            <p style={{ fontFamily: font.body, fontSize: 12, color: '#DC2626', marginBottom: 8, textAlign: 'center' }}>
              {actionError}
            </p>
          )}
          {markedComplete ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                position: 'relative', flex: 1,
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 16px', borderRadius: 8,
                background: '#F0FDF4', color: '#16A34A',
                fontFamily: 'var(--pw-font-ui)', fontSize: 13, fontWeight: 500,
              }}>
                <span style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
                  {justCompleted ? (
                    <>
                      <CheckmarkDraw size={14} color="#0D0D0D" />
                      <ParticleBurst count={12} size={64} />
                    </>
                  ) : (
                    <Check size={14} />
                  )}
                </span>
                Completed
              </div>
              <button
                onClick={handleMarkIncomplete}
                disabled={isPending || !pathwaySlug}
                style={{
                  flexShrink: 0,
                  display: 'inline-flex', alignItems: 'center',
                  padding: '8px 14px', borderRadius: 8,
                  border: `1px solid ${border}`, background: '#FFFFFF',
                  fontFamily: 'var(--pw-font-ui)', fontSize: 12, fontWeight: 500,
                  color: muted, cursor: isPending ? 'not-allowed' : 'pointer',
                  transition: 'color 120ms ease, border-color 120ms ease',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.color = ink;
                  (e.currentTarget as HTMLButtonElement).style.borderColor = ink;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.color = muted;
                  (e.currentTarget as HTMLButtonElement).style.borderColor = border;
                }}
              >
                Mark incomplete
              </button>
            </div>
          ) : (
            <button
              onClick={handleMarkComplete}
              disabled={isPending || !pathwaySlug}
              className="pw-focus"
              style={{
                width: '100%',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '10px 20px', borderRadius: 8,
                background: isPending ? '#E5E7EB' : ink,
                color: isPending ? muted : '#FFFFFF',
                fontFamily: 'var(--pw-font-ui)', fontSize: 14, fontWeight: 500,
                border: 'none', cursor: isPending ? 'not-allowed' : 'pointer',
                transition: 'opacity 100ms ease',
              }}
            >
              {isPending && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
              {isPending ? 'Saving...' : 'Mark as complete →'}
            </button>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes pw-shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
      `}</style>
    </>,
    document.body,
  );
}
