'use client';

import { useState, useTransition, useRef, useEffect, useCallback } from 'react';
import type { CSSProperties, MutableRefObject } from 'react';
import Link from 'next/link';
import { Clock, Home, ExternalLink, FileText, Mail, Loader2, ChevronDown, ChevronRight } from 'lucide-react';
import { updateStepProgress } from '@/app/actions/progress';
import { EmailTemplatesSection } from '@/components/dashboard/StepDetailDrawer';
import { documentBelongsToStep } from '@/lib/step-document-map';
import { getEmailTemplates } from '@/lib/email-templates';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useScrollFade } from '@/hooks/useScrollFade';
import { CheckmarkDraw } from '@/components/fx/CheckmarkDraw';
import { ParticleBurst } from '@/components/fx/ParticleBurst';
import type { EnrichedApplicationStep, DashboardDocument, ProfileContext, ChecklistItem } from '@/modules/dashboard/types';
import { registerChecklistFlush, flushAllChecklists } from '@/lib/checklist-flush-registry';

export interface ApplicationPageClientProps {
  pathway: {
    title: string;
    officialName: string;
    slug: string;
    processingTime: string;
    totalSteps: number;
    description: string;
  };
  steps: EnrichedApplicationStep[];
  profileContext: ProfileContext | null;
  documents: DashboardDocument[];
}

// ── Design tokens ─────────────────────────────────────────────────────────────

const INK = '#0A0A0A';
const MUTED = '#6B7280';
const BORDER_CARD = 'rgba(0,0,0,0.08)'; // matches profile page cards
const BORDER_INNER = 'rgba(0,0,0,0.06)'; // inner dividers
const BG = '#FFFFFF';
const TEXT_TERTIARY = '#9CA3AF';
const GREEN = '#16A34A';
const GREEN_BG = '#F0FDF4';
const ACCENT = '#1A56DB';
const font = { body: 'var(--pw-font-body)' as const, display: 'var(--pw-font-display)' as const };

const CARD: CSSProperties = { background: 'transparent', borderRadius: 12 };

const EYEBROW: CSSProperties = {
  fontFamily: font.body, fontSize: 11, fontWeight: 500,
  letterSpacing: '0.06em', textTransform: 'uppercase' as const,
  color: TEXT_TERTIARY, margin: 0,
};

// ── Sidebar step circle ───────────────────────────────────────────────────────

type StepStatus = 'complete' | 'current' | 'upcoming';

/** Circular icon conveying step completion state in the sidebar. */
function SidebarStepCircle({ status, stepNumber }: { status: StepStatus; stepNumber: number }) {
  if (status === 'complete') {
    return (
      <div style={{ width: 20, height: 20, borderRadius: '50%', background: INK, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
          <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    );
  }
  if (status === 'current') {
    return (
      <div style={{ width: 20, height: 20, borderRadius: '50%', border: `1.5px solid ${INK}`, background: 'transparent', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: INK, fontFamily: font.body, fontSize: 10 }}>
        {stepNumber}
      </div>
    );
  }
  return (
    <div style={{ width: 20, height: 20, borderRadius: '50%', border: '1.5px solid #D1D5DB', background: 'transparent', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF', fontFamily: font.body, fontSize: 10 }}>
      {stepNumber}
    </div>
  );
}

// ── Accordion checklist ───────────────────────────────────────────────────────

interface AccordionChecklistProps {
  stepId: string;
  checklistItems: ChecklistItem[];
  stepDocs: DashboardDocument[];
  pathwaySlug: string;
  stepNumber: number;
  profileContext: ProfileContext | null;
  resources: EnrichedApplicationStep['resources'];
  onCheckedChange: (n: number) => void;
  onAllChecked?: () => void;
}

/**
 * Accordion-style checklist card — each row expands inline to reveal its
 * content and actions. DB tasks, documents, email drafts, and resources
 * are all surfaced here as first-class checklist items.
 */
function AccordionChecklist({
  stepId,
  checklistItems,
  stepDocs,
  pathwaySlug,
  stepNumber,
  profileContext,
  resources,
  onCheckedChange,
  onAllChecked,
}: AccordionChecklistProps) {
  const [openKeys, setOpenKeys] = useState<Set<string>>(new Set());
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [hydrating, setHydrating] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onCheckedChangeRef = useRef(onCheckedChange);
  onCheckedChangeRef.current = onCheckedChange;
  const onAllCheckedRef = useRef(onAllChecked);
  onAllCheckedRef.current = onAllChecked;

  // Proxy refs — always point to the latest values so the flush fn registered
  // once at mount can call the current logic without re-registering.
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

  const templates = getEmailTemplates(pathwaySlug, stepNumber);
  const hasDocuments = stepDocs.length > 0;
  const hasEmail = templates.length > 0 && profileContext !== null;
  const hasResources = (resources?.length ?? 0) > 0;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || cancelled) return;
        const { data } = await (supabase as ReturnType<typeof createSupabaseBrowserClient>)
          .from('step_checklist_progress' as never)
          .select('checked_items')
          .eq('user_id', user.id)
          .eq('step_id', stepId)
          .maybeSingle() as unknown as { data: { checked_items: number[] } | null };
        if (!cancelled && data && Array.isArray(data.checked_items)) {
          const loaded = new Set<number>(data.checked_items);
          setChecked(loaded);
          onCheckedChangeRef.current(loaded.size);
        }
      } catch {
        // Non-fatal
      } finally {
        if (!cancelled) setHydrating(false);
      }
    })();
    return () => {
      cancelled = true;
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [stepId]);

  const persist = (next: Set<number>) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        await (supabase as ReturnType<typeof createSupabaseBrowserClient>)
          .from('step_checklist_progress' as never)
          .upsert(
            { user_id: user.id, step_id: stepId, checked_items: [...next], updated_at: new Date().toISOString() } as never,
            { onConflict: 'user_id,step_id' }
          );
      } catch {
        // Silently fail
      }
    }, 600);
  };

  const toggleChecked = (i: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = new Set(checked);
    next.has(i) ? next.delete(i) : next.add(i);
    // Keep the proxy ref current so an immediate flush (fired below via
    // onAllChecked) writes this toggle, not the stale render-time value.
    checkedRef.current = next;
    setChecked(next);
    onCheckedChangeRef.current(next.size);
    persist(next);
    if (next.size === checklistItems.length && checklistItems.length > 0) onAllCheckedRef.current?.();
  };

  const toggleOpen = (key: string) => {
    setOpenKeys((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const totalCheckable = checklistItems.length;
  const doneCount = checked.size;

  return (
    <div style={CARD}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: `1px solid ${BORDER_INNER}` }}>
        <span style={{ fontFamily: font.body, fontSize: 13, fontWeight: 500, color: INK }}>
          Tasks &amp; actions
        </span>
        {totalCheckable > 0 && (
          <span style={{ fontFamily: font.body, fontSize: 12, color: MUTED }}>
            {hydrating ? '–' : doneCount} of {totalCheckable} done
          </span>
        )}
      </div>

      {/* DB checklist items */}
      {checklistItems.map((item, i) => {
        const key = `task-${i}`;
        const isOpen = openKeys.has(key);
        const done = checked.has(i);
        return (
          <div key={key} style={{ borderBottom: `1px solid ${BORDER_INNER}` }}>
            {/* Row header */}
            <button
              type="button"
              onClick={() => toggleOpen(key)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '12px 20px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
            >
              {/* Custom checkbox */}
              <span
                role="checkbox"
                aria-checked={done}
                tabIndex={0}
                onClick={(e) => toggleChecked(i, e)}
                onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') toggleChecked(i, e as unknown as React.MouseEvent); }}
                className={done ? 'task-cb task-cb-checked' : 'task-cb'}
                style={{ flexShrink: 0 }}
              />
              <span style={{ flex: 1, fontFamily: font.body, fontSize: 13, color: done ? MUTED : INK, textDecoration: done ? 'line-through' : 'none', lineHeight: 1.5 }}>
                {item.label}
              </span>
              <span style={{ flexShrink: 0, color: TEXT_TERTIARY }}>
                {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </span>
            </button>
            {/* Expanded content */}
            {isOpen && (
              <div style={{ padding: '0 20px 16px 52px' }}>
                {item.detail && (
                  <p style={{ fontFamily: font.body, fontSize: 13, color: '#374151', lineHeight: 1.65, margin: '0 0 12px' }}>
                    {item.detail}
                  </p>
                )}
                {item.links && item.links.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                    {item.links.map((link) => (
                      <a
                        key={link.url}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: font.body, fontSize: 12, color: 'var(--pw-accent)', textDecoration: 'none', fontWeight: 500 }}
                      >
                        <ExternalLink size={11} />
                        {link.label}
                      </a>
                    ))}
                  </div>
                )}
                {item.tips && item.tips.length > 0 && (
                  <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: '8px 12px', marginBottom: 12 }}>
                    {item.tips.map((tip, ti) => (
                      <p key={ti} style={{ fontFamily: font.body, fontSize: 12, color: MUTED, lineHeight: 1.6, margin: ti === 0 ? 0 : '4px 0 0' }}>
                        <span style={{ color: 'var(--pw-accent)', fontWeight: 500 }}>Tip: </span>{tip}
                      </p>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  onClick={(e) => toggleChecked(i, e)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, border: `1px solid ${BORDER_CARD}`, background: done ? GREEN_BG : BG, fontFamily: font.body, fontSize: 12, fontWeight: 500, color: done ? GREEN : INK, cursor: 'pointer' }}
                >
                  {done ? '✓ Marked done' : 'Mark as done'}
                </button>
              </div>
            )}
          </div>
        );
      })}

      {/* Documents section item */}
      {hasDocuments && (() => {
        const key = 'documents';
        const isOpen = openKeys.has(key);
        return (
          <div key={key} style={{ borderBottom: `1px solid ${BORDER_INNER}` }}>
            <button type="button" onClick={() => toggleOpen(key)} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '12px 20px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
              <div style={{ width: 20, height: 20, borderRadius: '50%', border: `1.5px solid ${BORDER_CARD}`, background: 'transparent', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FileText size={10} color={MUTED} />
              </div>
              <span style={{ flex: 1, fontFamily: font.body, fontSize: 13, color: INK, lineHeight: 1.5 }}>
                Documents needed
                <span style={{ fontFamily: font.body, fontSize: 11, color: MUTED, marginLeft: 6 }}>({stepDocs.length})</span>
              </span>
              <span style={{ flexShrink: 0, color: TEXT_TERTIARY }}>
                {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </span>
            </button>
            {isOpen && (
              <div style={{ padding: '4px 20px 16px 52px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {stepDocs.map((doc) => (
                  <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', border: `1px dashed ${BORDER_CARD}`, borderRadius: 8 }}>
                    <FileText size={13} color={MUTED} style={{ flexShrink: 0 }} />
                    <span style={{ fontFamily: font.body, fontSize: 13, color: MUTED, flex: 1, minWidth: 0 }}>{doc.name}</span>
                    <button type="button" style={{ fontFamily: font.body, fontSize: 12, fontWeight: 500, color: ACCENT, background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}>
                      Upload
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* Email drafts section item */}
      {hasEmail && (() => {
        const key = 'email';
        const isOpen = openKeys.has(key);
        return (
          <div key={key} style={{ borderBottom: `1px solid ${BORDER_INNER}` }}>
            <button type="button" onClick={() => toggleOpen(key)} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '12px 20px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
              <div style={{ width: 20, height: 20, borderRadius: '50%', border: `1.5px solid ${BORDER_CARD}`, background: 'transparent', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Mail size={10} color={MUTED} />
              </div>
              <span style={{ flex: 1, fontFamily: font.body, fontSize: 13, color: INK, lineHeight: 1.5 }}>
                Email drafts
                <span style={{ fontFamily: font.body, fontSize: 11, color: MUTED, marginLeft: 6 }}>({templates.length})</span>
              </span>
              <span style={{ flexShrink: 0, color: TEXT_TERTIARY }}>
                {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </span>
            </button>
            {isOpen && profileContext && (
              <div style={{ padding: '4px 20px 16px 52px' }}>
                <EmailTemplatesSection pathwaySlug={pathwaySlug} stepNumber={stepNumber} profileContext={profileContext} />
              </div>
            )}
          </div>
        );
      })()}

      {/* Official resources section item */}
      {hasResources && resources && (() => {
        const key = 'resources';
        const isOpen = openKeys.has(key);
        return (
          <div key={key}>
            <button type="button" onClick={() => toggleOpen(key)} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '12px 20px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
              <div style={{ width: 20, height: 20, borderRadius: '50%', border: `1.5px solid ${BORDER_CARD}`, background: 'transparent', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ExternalLink size={10} color={MUTED} />
              </div>
              <span style={{ flex: 1, fontFamily: font.body, fontSize: 13, color: INK, lineHeight: 1.5 }}>
                Official resources
                <span style={{ fontFamily: font.body, fontSize: 11, color: MUTED, marginLeft: 6 }}>({resources.length})</span>
              </span>
              <span style={{ flexShrink: 0, color: TEXT_TERTIARY }}>
                {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </span>
            </button>
            {isOpen && (
              <div style={{ padding: '4px 12px 12px 52px' }}>
                {resources.map((r, i) => (
                  <a
                    key={i}
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 8px', borderRadius: 6, textDecoration: 'none' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = '#F9FAFB'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = 'transparent'; }}
                  >
                    <ExternalLink size={13} style={{ color: MUTED, flexShrink: 0 }} />
                    <span style={{ fontFamily: font.body, fontSize: 13, color: INK, flex: 1, minWidth: 0 }}>{r.label}</span>
                    <ExternalLink size={11} style={{ color: MUTED, flexShrink: 0, opacity: 0.4 }} />
                  </a>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* Empty state */}
      {checklistItems.length === 0 && !hasDocuments && !hasEmail && !hasResources && (
        <div style={{ padding: '20px', textAlign: 'center' }}>
          <p style={{ fontFamily: font.body, fontSize: 13, color: MUTED, margin: 0 }}>
            No tasks for this step.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Pathway overview panel ────────────────────────────────────────────────────

/** Pathway overview — shown when no step is selected. */
function OverviewPanel({ pathway }: { pathway: ApplicationPageClientProps['pathway'] }) {
  return (
    <div style={{ padding: '28px 32px' }}>
      <div style={{ ...CARD, padding: '28px' }}>
        <p style={{ ...EYEBROW, marginBottom: 12 }}>Your pathway</p>
        <h1 style={{ fontFamily: font.display, fontSize: 24, fontWeight: 400, color: INK, margin: '0 0 4px', lineHeight: 1.2 }}>
          {pathway.title}
        </h1>
        {pathway.officialName && (
          <p style={{ fontFamily: font.body, fontSize: 13, color: MUTED, margin: '0 0 20px' }}>{pathway.officialName}</p>
        )}
        <hr style={{ border: 'none', borderTop: `1px solid ${BORDER_INNER}`, margin: '0 0 20px' }} />
        <div style={{ display: 'flex', gap: 40, marginBottom: pathway.description ? 20 : 0 }}>
          <div>
            <p style={{ ...EYEBROW, marginBottom: 4 }}>Processing time</p>
            <p style={{ fontFamily: font.body, fontSize: 14, color: INK, margin: 0 }}>{pathway.processingTime}</p>
          </div>
          <div>
            <p style={{ ...EYEBROW, marginBottom: 4 }}>Total steps</p>
            <p style={{ fontFamily: font.body, fontSize: 14, color: INK, margin: 0 }}>{pathway.totalSteps}</p>
          </div>
        </div>
        {pathway.description && (
          <p style={{ fontFamily: font.body, fontSize: 14, color: '#374151', margin: '0 0 28px', lineHeight: 1.7, maxWidth: 560 }}>
            {pathway.description}
          </p>
        )}
        <Link
          href="/onboarding/matches"
          style={{ fontFamily: font.body, fontSize: 13, color: INK, textDecoration: 'none', opacity: 0.7 }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.opacity = '1'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.opacity = '0.7'; }}
        >
          Change pathway →
        </Link>
      </div>
    </div>
  );
}

// ── Step detail panel ─────────────────────────────────────────────────────────

interface StepDetailPanelProps {
  step: EnrichedApplicationStep;
  steps: EnrichedApplicationStep[];
  documents: DashboardDocument[];
  pathwaySlug: string;
  profileContext: ProfileContext | null;
  isCompleted: boolean;
  onMarkComplete: (stepId: string) => void;
  onMarkIncomplete: (stepId: string) => void;
  onSelectStep: (id: string | 'overview') => void;
  onAllChecked?: () => void;
  markCompleteRef?: MutableRefObject<((onSuccess?: () => void) => void) | null>;
}

/** Step detail — objective card, accordion task list, completion bar. */
function StepDetailPanel({
  step,
  steps,
  documents,
  pathwaySlug,
  profileContext,
  isCompleted,
  onMarkComplete,
  onMarkIncomplete,
  onSelectStep,
  onAllChecked,
  markCompleteRef,
}: StepDetailPanelProps) {
  const { ref: scrollRef, faded } = useScrollFade();
  const [isPending, startTransition] = useTransition();
  const [justCompleted, setJustCompleted] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [checkedCount, setCheckedCount] = useState(0);

  const handleCheckedChange = useCallback((n: number) => { setCheckedCount(n); }, []);

  const handleMarkComplete = (onSuccess?: () => void) => {
    setActionError(null);
    startTransition(async () => {
      try {
        await updateStepProgress({ stepId: step.id, pathwaySlug, status: 'complete' });
        setJustCompleted(true);
        onMarkComplete(step.id);
        onSuccess?.();
      } catch {
        setActionError('Failed to save. Please try again.');
      }
    });
  };

  const handleMarkIncomplete = () => {
    setActionError(null);
    setJustCompleted(false);
    startTransition(async () => {
      try {
        await updateStepProgress({ stepId: step.id, pathwaySlug, status: 'upcoming' });
        onMarkIncomplete(step.id);
      } catch {
        setActionError('Failed to save. Please try again.');
      }
    });
  };

  // Expose the button's mark-complete flow so the parent's auto-complete handler
  // can trigger the identical path (DB write + success animation).
  useEffect(() => {
    if (markCompleteRef) markCompleteRef.current = handleMarkComplete;
  });

  const stepDocs = documents.filter((d) => documentBelongsToStep(d.name, step.stepNumber));
  const currentIdx = steps.findIndex((s) => s.id === step.id);
  const nextStep = currentIdx >= 0 && currentIdx < steps.length - 1 ? steps[currentIdx + 1] : null;

  const totalTasks = step.checklistItems?.length ?? 0;
  const remaining = totalTasks > 0 ? totalTasks - checkedCount : 0;
  const completionLabel = isCompleted
    ? 'Step complete'
    : totalTasks > 0
      ? `${remaining} ${remaining === 1 ? 'task' : 'tasks'} remaining`
      : 'Ready to mark complete';

  const ss = isCompleted || step.status === 'complete'
    ? { bg: GREEN_BG, color: GREEN, label: 'Complete' }
    : step.status === 'current'
      ? { bg: '#F3F4F6', color: INK, label: 'In progress' }
      : { bg: '#F3F4F6', color: MUTED, label: 'Upcoming' };

  const checklistItems = step.checklistItems ?? [];

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

      {/* Scrollable content */}
      <div className="pw-scroll-fade" data-faded={faded} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <div ref={scrollRef} className="pw-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '22px 32px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>

          {/* Section 1 — Objective */}
          <div style={CARD}>
            <div style={{ padding: '16px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={EYEBROW}>Step {step.stepNumber}</span>
                  <span style={{ display: 'inline-block', padding: '2px 9px', borderRadius: 9999, background: ss.bg, color: ss.color, fontFamily: font.body, fontSize: 11, fontWeight: 500 }}>
                    {ss.label}
                  </span>
                </div>
                {step.estimatedDuration && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 9999, background: '#F3F4F6', fontFamily: font.body, fontSize: 12, color: MUTED }}>
                    <Clock size={12} />
                    {step.estimatedDuration}
                  </span>
                )}
              </div>
              <h1 style={{ fontFamily: font.display, fontSize: 20, fontWeight: 500, color: INK, margin: '0 0 12px', lineHeight: 1.3 }}>
                {step.label}
              </h1>
              {step.description && (
                <p style={{ fontFamily: font.body, fontSize: 14, color: '#374151', margin: 0, lineHeight: 1.65 }}>
                  {step.description}
                </p>
              )}
            </div>
          </div>

          {/* Section 2 — Accordion tasks & actions */}
          <AccordionChecklist
            key={step.id}
            stepId={step.id}
            checklistItems={checklistItems}
            stepDocs={stepDocs}
            pathwaySlug={pathwaySlug}
            stepNumber={step.stepNumber}
            profileContext={profileContext}
            resources={step.resources}
            onCheckedChange={handleCheckedChange}
            onAllChecked={onAllChecked}
          />

        </div>
      </div>
      </div>

      {/* Completion bar */}
      <div style={{ borderTop: `1px solid ${BORDER_INNER}`, padding: '14px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexShrink: 0 }}>

        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ position: 'relative', flexShrink: 0, width: 20, height: 20 }}>
              {isCompleted && justCompleted ? (
                <>
                  <CheckmarkDraw size={20} color={GREEN} />
                  <ParticleBurst count={10} size={48} />
                </>
              ) : (
                <div style={{ width: 20, height: 20, borderRadius: '50%', background: isCompleted ? GREEN : '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                    <path d="M1 3.5L3.5 6L8 1" stroke={isCompleted ? 'white' : '#9CA3AF'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              )}
            </div>
            <span style={{ fontFamily: font.body, fontSize: 13, fontWeight: 500, color: isCompleted ? GREEN : INK }}>
              {completionLabel}
            </span>
          </div>
          {actionError && (
            <p style={{ fontFamily: font.body, fontSize: 12, color: '#DC2626', margin: '4px 0 0' }}>{actionError}</p>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => onSelectStep('overview')}
            style={{ display: 'inline-flex', alignItems: 'center', padding: '8px 16px', borderRadius: 8, border: `1px solid ${BORDER_CARD}`, background: BG, fontFamily: font.body, fontSize: 13, fontWeight: 500, color: INK, cursor: 'pointer' }}
          >
            ← Back to overview
          </button>
          {isCompleted ? (
            <button
              type="button"
              onClick={handleMarkIncomplete}
              disabled={isPending}
              style={{ display: 'inline-flex', alignItems: 'center', padding: '8px 16px', borderRadius: 8, border: `1px solid ${BORDER_CARD}`, background: BG, fontFamily: font.body, fontSize: 13, fontWeight: 500, color: MUTED, cursor: isPending ? 'not-allowed' : 'pointer' }}
            >
              Mark incomplete
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleMarkComplete()}
              disabled={isPending}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, background: isPending ? '#E5E7EB' : INK, color: isPending ? MUTED : '#FFFFFF', border: 'none', fontFamily: font.body, fontSize: 13, fontWeight: 500, cursor: isPending ? 'not-allowed' : 'pointer' }}
            >
              {isPending && <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />}
              {isPending ? 'Saving…' : 'Mark as complete'}
            </button>
          )}
          {nextStep && (
            <button
              type="button"
              onClick={() => { if (isCompleted) onSelectStep(nextStep.id); }}
              disabled={!isCompleted}
              title={!isCompleted ? 'Complete this step first' : undefined}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, background: isCompleted ? INK : '#E5E7EB', color: isCompleted ? '#FFFFFF' : MUTED, border: 'none', fontFamily: font.body, fontSize: 13, fontWeight: 500, cursor: isCompleted ? 'pointer' : 'not-allowed' }}
            >
              Next step →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

/** Application page — floating left sidebar + white card content area. */
export function ApplicationPageClient({ pathway, steps, profileContext, documents }: ApplicationPageClientProps) {
  const { ref: overviewScrollRef, faded: overviewFaded } = useScrollFade();
  const [selectedId, setSelectedId] = useState<string>('overview');
  const [completedIds, setCompletedIds] = useState<Set<string>>(
    () => new Set(steps.filter((s) => s.status === 'complete').map((s) => s.id))
  );

  const autoAdvanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const markCompleteRef = useRef<((onSuccess?: () => void) => void) | null>(null);

  const clearAutoAdvance = () => {
    if (autoAdvanceRef.current) {
      clearTimeout(autoAdvanceRef.current);
      autoAdvanceRef.current = null;
    }
  };

  // Manual navigation cancels any pending auto-advance (D).
  const handleSelectStep = (id: string) => {
    clearAutoAdvance();
    setSelectedId(id);
  };

  // Clear a pending auto-advance timer on unmount (D).
  useEffect(() => () => {
    if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);
  }, []);

  const handleMarkComplete = (stepId: string) => setCompletedIds((prev) => new Set([...prev, stepId]));
  const handleMarkIncomplete = (stepId: string) => {
    setCompletedIds((prev) => { const next = new Set(prev); next.delete(stepId); return next; });
  };

  // Auto-complete when every checklist item is checked (B). Idempotent, and
  // flushes pending checklist writes before completing so none are lost.
  const handleAutoComplete = () => {
    if (completedIds.has(selectedId)) return;
    flushAllChecklists();
    // Advance only on the checklist path — passed as the success callback so the
    // timer starts after the mark-complete write resolves (button path passes none).
    markCompleteRef.current?.(() => scheduleAutoAdvance(selectedId));
  };

  // After a step completes, advance to the next still-incomplete step (C).
  const scheduleAutoAdvance = (fromId: string) => {
    const idx = steps.findIndex((s) => s.id === fromId);
    if (idx < 0) return;
    let nextId: string | null = null;
    for (let i = idx + 1; i < steps.length; i++) {
      if (!completedIds.has(steps[i].id)) { nextId = steps[i].id; break; }
    }
    if (nextId === null) return; // all remaining steps complete — stay put
    const target = nextId;
    clearAutoAdvance();
    autoAdvanceRef.current = setTimeout(() => {
      autoAdvanceRef.current = null;
      setSelectedId(target);
    }, 800);
  };

  const selectedStep = steps.find((s) => s.id === selectedId) ?? null;
  const completedCount = completedIds.size;
  const progressPct = steps.length > 0 ? Math.round((completedCount / steps.length) * 100) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>

      {/* ─── Persistent pathway strip — static above both columns ─── */}
      <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 16, padding: '0 32px', height: 40, borderBottom: `1px solid ${BORDER_INNER}`, flexShrink: 0 }}>
        <span style={{ fontFamily: font.display, fontWeight: 500, fontSize: 13, color: INK, whiteSpace: 'nowrap' }}>
          {pathway.title}
        </span>
        <div style={{ flex: 1, height: 2, borderRadius: 9999, background: '#EBEBEB', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${progressPct}%`, background: INK, borderRadius: 9999, transition: 'width 400ms cubic-bezier(0.16,1,0.3,1)', minWidth: completedCount > 0 ? 6 : 0 }} />
        </div>
        <span style={{ fontFamily: font.body, fontSize: 12, color: MUTED, whiteSpace: 'nowrap' }}>
          {completedCount} of {steps.length} complete · {progressPct}%
        </span>
      </div>

      {/* ─── Two-column row ─── */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden', gap: 32 }}>

      {/* ─── Left sidebar — floating card, fluid width ─── */}
      <div style={{ flexShrink: 0, width: '32%', minWidth: 260, maxWidth: 340, padding: '16px 0 16px 24px', display: 'flex', alignItems: 'stretch' }}>
        <div className="pw-scroll" style={{ width: '100%', borderRadius: 14, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

          {/* Nav list */}
          <nav style={{ padding: '10px 8px', flex: 1 }}>
            <button
              type="button"
              onClick={() => handleSelectStep('overview')}
              className={`app-sidebar-item${selectedId === 'overview' ? ' is-selected' : ''}`}
              style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '9px 10px', cursor: 'pointer', textAlign: 'left' }}
            >
              <div className="item-icon" style={{ width: 24, height: 24, borderRadius: 7, flexShrink: 0, background: selectedId === 'overview' ? '#E8E8E8' : '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Home size={12} color={selectedId === 'overview' ? INK : '#9CA3AF'} />
              </div>
              <span className="item-label" style={{ fontFamily: font.body, fontSize: 13, fontWeight: selectedId === 'overview' ? 500 : 400 }}>
                Pathway overview
              </span>
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '10px 4px 6px' }}>
              <span style={{ fontFamily: font.body, fontSize: 9, fontWeight: 500, letterSpacing: '0.10em', color: '#C8C8C8', textTransform: 'uppercase', flexShrink: 0 }}>Steps</span>
              <div style={{ flex: 1, height: 1, background: 'rgba(0,0,0,0.06)' }} />
            </div>

            {steps.map((step) => {
              const isSelected = selectedId === step.id;
              const effectiveStatus: StepStatus = completedIds.has(step.id) ? 'complete' : step.status;
              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => handleSelectStep(step.id)}
                  className={`app-sidebar-item${isSelected ? ' is-selected' : ''}`}
                  style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '6px 10px', cursor: 'pointer', textAlign: 'left' }}
                >
                  <div className="item-icon" style={{ flexShrink: 0 }}>
                    <SidebarStepCircle status={effectiveStatus} stepNumber={step.stepNumber} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p className="item-label" style={{ fontFamily: font.body, fontSize: 12, fontWeight: isSelected ? 500 : 400, margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.4 }}>
                      {step.label}
                    </p>
                    {step.estimatedDuration && (
                      <p style={{ fontFamily: font.body, fontSize: 10, color: '#A0A0A0', margin: '1px 0 0' }}>{step.estimatedDuration}</p>
                    )}
                  </div>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* ─── Right content area — fills remaining space ─── */}
      <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {selectedId === 'overview' || selectedStep === null ? (
          <div className="pw-scroll-fade" data-faded={overviewFaded} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <div ref={overviewScrollRef} className="pw-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
              <OverviewPanel pathway={pathway} />
            </div>
          </div>
        ) : (
          <StepDetailPanel
            key={selectedStep.id}
            step={selectedStep}
            steps={steps}
            documents={documents}
            pathwaySlug={pathway.slug}
            profileContext={profileContext}
            isCompleted={completedIds.has(selectedStep.id)}
            onMarkComplete={handleMarkComplete}
            onMarkIncomplete={handleMarkIncomplete}
            onSelectStep={handleSelectStep}
            onAllChecked={handleAutoComplete}
            markCompleteRef={markCompleteRef}
          />
        )}
      </div>

      </div>

      <style>{`
        .app-sidebar-item {
          background: transparent;
          border: 1.5px solid transparent;
          border-radius: 8px;
          transition: background 100ms ease, border-color 100ms ease;
        }
        .app-sidebar-item.is-selected {
          background: rgba(0,0,0,0.04);
          border-color: rgba(0,0,0,0.14);
        }
        .app-sidebar-item:not(.is-selected):hover {
          background: rgba(0,0,0,0.03);
          border-color: rgba(0,0,0,0.08);
        }
        .app-sidebar-item .item-label { color: #6B7280; transition: color 100ms ease; }
        .app-sidebar-item.is-selected .item-label { color: #0A0A0A; }
        .app-sidebar-item:not(.is-selected):hover .item-label { color: #374151; }
        .app-sidebar-item .item-icon { transition: transform 150ms cubic-bezier(0.16,1,0.3,1); }
        .app-sidebar-item:hover .item-icon { transform: scale(1.10); }
        .app-sidebar-item:active .item-icon { transform: scale(1.0); }

        /* Custom checkbox for tasks */
        .task-cb {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 18px;
          height: 18px;
          border: 1.5px solid #D1D5DB;
          border-radius: 4px;
          cursor: pointer;
          background: white;
          flex-shrink: 0;
          transition: background 120ms ease, border-color 120ms ease;
        }
        .task-cb-checked {
          background: #0A0A0A;
          border-color: #0A0A0A;
          background-image: url("data:image/svg+xml,%3csvg viewBox='0 0 16 16' fill='white' xmlns='http://www.w3.org/2000/svg'%3e%3cpath d='M12.207 4.793a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0l-2-2a1 1 0 011.414-1.414L6.5 9.086l4.293-4.293a1 1 0 011.414 0z'/%3e%3c/svg%3e");
          background-size: 100% 100%;
          background-position: center;
          background-repeat: no-repeat;
        }
        .task-cb:hover:not(.task-cb-checked) { border-color: #9CA3AF; }

        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
      `}</style>
    </div>
  );
}
