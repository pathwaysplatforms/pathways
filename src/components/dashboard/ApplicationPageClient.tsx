'use client';

import { useState, useTransition, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Home, ExternalLink, FileText, Mail, Loader2, ChevronDown, ChevronRight, Check, UploadCloud, ArrowLeft,
  BookOpen, HeartPulse, Fingerprint, CreditCard, Briefcase, GraduationCap, Building2, Calendar, Plane, ClipboardList,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { updateStepProgress } from '@/app/actions/progress';
import { saveChecklistInput } from '@/app/actions/profile';
import { EmailTemplatesSection } from '@/components/dashboard/StepDetailDrawer';
import { AiGenerateModal } from '@/components/dashboard/AiGenerateModal';
import { documentBelongsToStep } from '@/lib/step-document-map';
import { getEmailTemplates } from '@/lib/email-templates';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useScrollFade } from '@/hooks/useScrollFade';
import type { EnrichedApplicationStep, DashboardDocument, ProfileContext, ChecklistItem, AiActionType } from '@/modules/dashboard/types';
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
  crsScore: number | null;
  /** Returns to the applications-home list (replaces the old pathway dropdown). */
  onBack: () => void;
}

// ── Design tokens ─────────────────────────────────────────────────────────────

const INK = '#0A0A0A';
const MUTED = '#6B7280';
const BORDER = '1px solid rgba(0,0,0,0.30)';         // thin black — panel + card container edges
const BORDER_INNER = '1px solid rgba(0,0,0,0.08)';   // inner dividers, softer
const PANEL_SHADOW = '0 1px 2px rgba(16,24,40,0.04), 0 1px 8px rgba(16,24,40,0.03)';
const BG = '#FFFFFF';
const PAGE_BG = '#FFFFFF';                           // white gutter behind the separated panels
const CARD_RADIUS = 16;
const PILL = 999;
const CONTENT_MAX_WIDTH = 760;                       // centered reading column width for the main content area
const TEXT_TERTIARY = '#9CA3AF';
const GREEN = '#16A34A';
const ACCENT = '#1A56DB';
const ACCENT_TINT = 'rgba(26,86,219,0.08)';
const AI_TEAL = '#14909C';                            // platform's design-system teal (--color-accent-500) — reserved for AI-generation actions
const PROGRESS_TEAL = '#0E7BA6';                      // teal-blue used for the step progress bar
const font = { body: 'var(--pw-font-body)' as const, display: 'var(--pw-font-display)' as const };

// ── Sidebar step icon ─────────────────────────────────────────────────────────

const STEP_ICON_SIZE = 20;

// Keyword → icon lookup so incomplete steps get a little icon that hints at
// the step's content, rather than a generic placeholder — checked in order,
// first match wins.
const STEP_ICON_KEYWORDS: [RegExp, LucideIcon][] = [
  [/language|ielts|celpip|tef/i, BookOpen],
  [/medical|health/i, HeartPulse],
  [/biometric|photo|fingerprint/i, Fingerprint],
  [/fee|pay|payment/i, CreditCard],
  [/noc|occupation|job|employ/i, Briefcase],
  [/education|credential|eca|degree/i, GraduationCap],
  [/bank|fund|financ/i, Building2],
  [/interview|appointment/i, Calendar],
  [/passport|travel|visa stamp/i, Plane],
  [/document|file|form|upload/i, FileText],
];

function getStepIcon(label: string): LucideIcon {
  const match = STEP_ICON_KEYWORDS.find(([pattern]) => pattern.test(label));
  return match ? match[1] : ClipboardList;
}

/** Icon conveying step completion state in the sidebar — a filled green
 * checkmark when done, a bare content-hinted icon otherwise. */
function SidebarStepIcon({ completed, label }: { completed: boolean; label: string }) {
  if (completed) {
    return (
      <div style={{ width: STEP_ICON_SIZE, height: STEP_ICON_SIZE, borderRadius: '50%', background: GREEN, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Check size={12} color="#fff" strokeWidth={3} />
      </div>
    );
  }
  const Icon = getStepIcon(label);
  return (
    <div style={{ width: STEP_ICON_SIZE, height: STEP_ICON_SIZE, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Icon size={17} strokeWidth={1.75} color={INK} />
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
  onDocumentsReadyChange?: (ready: boolean) => void;
}

/**
 * Accordion-style checklist card — each row expands inline to reveal its
 * content and actions.
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
  onDocumentsReadyChange,
}: AccordionChecklistProps) {
  // Documents needed starts expanded — it's the one section users need to act on
  // immediately, so it shouldn't require an extra click to even see what's required.
  const [openKeys, setOpenKeys] = useState<Set<string>>(() => new Set(['documents']));
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [hydrating, setHydrating] = useState(true);
  const [aiModal, setAiModal] = useState<{ actionType: AiActionType; modalTitle: string } | null>(null);
  const [inputValues, setInputValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    if (profileContext?.nocCode) initial['noc_code'] = profileContext.nocCode;
    if (profileContext?.occupation) initial['occupation'] = profileContext.occupation;
    const pij = profileContext?.pathwayInputJson ?? {};
    for (const [k, v] of Object.entries(pij)) initial[k] = v;
    return initial;
  });
  const [inputStatus, setInputStatus] = useState<Record<string, 'idle' | 'saving' | 'saved' | 'error'>>({});
  const [docUploadStates, setDocUploadStates] = useState<Record<string, 'idle' | 'uploading' | 'success' | 'error'>>({});
  // Seed from persisted status so documents uploaded in a prior session still count.
  const [uploadedDocIds, setUploadedDocIds] = useState<Set<string>>(
    () => new Set(stepDocs.filter((d) => d.status === 'uploaded' || d.status === 'verified').map((d) => d.id))
  );
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onCheckedChangeRef = useRef(onCheckedChange);
  onCheckedChangeRef.current = onCheckedChange;
  const onAllCheckedRef = useRef(onAllChecked);
  onAllCheckedRef.current = onAllChecked;
  const onDocumentsReadyChangeRef = useRef(onDocumentsReadyChange);
  onDocumentsReadyChangeRef.current = onDocumentsReadyChange;

  // Report document-upload readiness up so the parent can gate step completion.
  useEffect(() => {
    const ready = stepDocs.length === 0 || uploadedDocIds.size >= stepDocs.length;
    onDocumentsReadyChangeRef.current?.(ready);
  }, [uploadedDocIds, stepDocs.length]);
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

  const handleSaveInput = async (key: string, value: string) => {
    setInputStatus((s) => ({ ...s, [key]: 'saving' }));
    try {
      await saveChecklistInput(key, value.trim() || null);
      setInputStatus((s) => ({ ...s, [key]: 'saved' }));
      setTimeout(() => setInputStatus((s) => ({ ...s, [key]: 'idle' })), 2200);
    } catch {
      setInputStatus((s) => ({ ...s, [key]: 'error' }));
    }
  };

  const handleDocUpload = async (docId: string, documentType: string | null, file: File) => {
    setDocUploadStates((s) => ({ ...s, [docId]: 'uploading' }));
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (documentType) formData.append('document_type', documentType);
      const res = await fetch('/api/vault/upload', { method: 'POST', body: formData });
      if (!res.ok) {
        const json = await res.json().catch(() => ({})) as { error?: { message?: string } };
        throw new Error(json?.error?.message ?? 'Upload failed');
      }
      setDocUploadStates((s) => ({ ...s, [docId]: 'success' }));
      setUploadedDocIds((prev) => new Set([...prev, docId]));
    } catch {
      setDocUploadStates((s) => ({ ...s, [docId]: 'error' }));
    }
  };

  const totalCheckable = checklistItems.length;
  const doneCount = checked.size;
  const rowCardStyle: React.CSSProperties = { border: BORDER, borderRadius: CARD_RADIUS, background: BG, boxShadow: PANEL_SHADOW, overflow: 'hidden' };
  // Main "Tasks & actions" list — rounded top, square bottom (distinct from the
  // separated documents/email/resources cards below it, which stay fully rounded).
  const taskListCardStyle: React.CSSProperties = {
    ...rowCardStyle,
    borderRadius: 0,
    borderTopLeftRadius: CARD_RADIUS,
    borderTopRightRadius: CARD_RADIUS,
  };
  const rowHeaderStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 14, width: '100%', padding: '16px 20px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' };
  const rowIconStyle: React.CSSProperties = { width: 30, height: 30, borderRadius: PILL, background: '#F5F4F8', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Header label */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
        <span style={{ fontFamily: font.body, fontSize: 14, fontWeight: 500, color: INK, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Tasks &amp; actions
        </span>
        {totalCheckable > 0 && (
          <span style={{ fontFamily: font.body, fontSize: 13, color: MUTED }}>
            {hydrating ? '–' : doneCount}/{totalCheckable}
          </span>
        )}
      </div>

      {checklistItems.length > 0 && (
      <div style={taskListCardStyle}>
      {checklistItems.map((item, i) => {
        const key = `task-${i}`;
        const isOpen = openKeys.has(key);
        const done = checked.has(i);
        return (
          <div key={key} style={{ borderBottom: i < checklistItems.length - 1 ? BORDER_INNER : 'none' }}>
            <button
              type="button"
              onClick={() => toggleOpen(key)}
              style={rowHeaderStyle}
            >
              <span
                role="checkbox"
                aria-checked={done}
                tabIndex={0}
                onClick={(e) => toggleChecked(i, e)}
                onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') toggleChecked(i, e as unknown as React.MouseEvent); }}
                className={done ? 'task-cb task-cb-checked' : 'task-cb'}
                style={{ flexShrink: 0 }}
              />
              <span style={{ flex: 1, fontFamily: font.body, fontSize: 15, color: done ? MUTED : INK, textDecoration: done ? 'line-through' : 'none', lineHeight: 1.5 }}>
                {item.label}
              </span>
              <span style={{ flexShrink: 0, color: TEXT_TERTIARY }}>
                {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </span>
            </button>
            {isOpen && (
              <div style={{ padding: '0 18px 18px' }}>
                <div style={{ background: ACCENT_TINT, borderRadius: CARD_RADIUS - 4, padding: '14px 16px', border: BORDER_INNER }}>
                  {item.detail && (
                    <p style={{ fontFamily: font.body, fontSize: 13, color: MUTED, lineHeight: 1.65, margin: '0 0 12px' }}>{item.detail}</p>
                  )}
                  {item.links && item.links.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 12 }}>
                      {item.links.map((link) => (
                        <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer" className="subtle-link"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: font.body, fontSize: 12, fontWeight: 500, color: ACCENT, textDecoration: 'none', alignSelf: 'flex-start' }}>
                          <ExternalLink size={11} style={{ flexShrink: 0, opacity: 0.75 }} />
                          {link.label}
                        </a>
                      ))}
                    </div>
                  )}
                  {item.tips && item.tips.length > 0 && (
                    <div style={{ background: BG, borderRadius: 12, padding: '8px 12px', marginBottom: 12, border: BORDER_INNER }}>
                      {item.tips.map((tip, ti) => (
                        <p key={ti} style={{ fontFamily: font.body, fontSize: 12, color: MUTED, lineHeight: 1.6, margin: ti === 0 ? 0 : '4px 0 0' }}>
                          <span style={{ color: ACCENT, fontWeight: 500 }}>Tip: </span>{tip}
                        </p>
                      ))}
                    </div>
                  )}
                  {item.input_field && (() => {
                    const field = item.input_field;
                    const fkey = field.key;
                    const fval = inputValues[fkey] ?? '';
                    const fstatus = inputStatus[fkey] ?? 'idle';
                    const isSaving = fstatus === 'saving';
                    return (
                      <div style={{ marginBottom: 12 }}>
                        <label style={{ display: 'block', fontFamily: font.body, fontSize: 11, fontWeight: 500, color: '#374151', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 5 }}>
                          {field.label}
                        </label>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <input type={field.type ?? 'text'} value={fval} placeholder={field.placeholder}
                            onChange={(e) => setInputValues((v) => ({ ...v, [fkey]: e.target.value }))}
                            onKeyDown={(e) => { if (e.key === 'Enter') void handleSaveInput(fkey, fval); }}
                            className="checklist-input"
                            style={{ flex: 1, height: 38, padding: '0 14px', borderRadius: PILL, border: '1px solid rgba(26,86,219,0.22)', background: BG, fontFamily: font.body, fontSize: 13, color: INK, outline: 'none' }} />
                          <button type="button" onClick={() => void handleSaveInput(fkey, fval)} disabled={isSaving}
                            style={{ height: 38, padding: '0 16px', borderRadius: PILL, border: '1.5px solid rgba(0,0,0,0.55)', background: BG, color: INK, fontFamily: font.body, fontSize: 12, fontWeight: 500, cursor: isSaving ? 'default' : 'pointer', flexShrink: 0, opacity: isSaving ? 0.6 : 1 }}>
                            {fstatus === 'saving' ? 'Saving…' : fstatus === 'saved' ? '✓ Saved' : fstatus === 'error' ? 'Retry' : 'Save'}
                          </button>
                        </div>
                        {field.hint && <p style={{ fontFamily: font.body, fontSize: 11, color: MUTED, margin: '5px 0 0', lineHeight: 1.5 }}>{field.hint}</p>}
                        {fstatus === 'error' && <p style={{ fontFamily: font.body, fontSize: 11, color: '#D0000C', margin: '4px 0 0' }}>Failed to save — please try again.</p>}
                      </div>
                    );
                  })()}
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    {item.ai_action && (
                      <button type="button" onClick={() => setAiModal({ actionType: item.ai_action!.type, modalTitle: item.ai_action!.modal_title })}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 18px', borderRadius: PILL, border: 'none', background: AI_TEAL, fontFamily: font.body, fontSize: 12, fontWeight: 600, color: '#fff', cursor: 'pointer', boxShadow: '0 2px 8px rgba(8,145,178,0.25)' }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
                          <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
                        </svg>
                        {item.ai_action.button_label}
                      </button>
                    )}
                    <button type="button" onClick={(e) => toggleChecked(i, e)}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 18px', borderRadius: PILL, border: `1.5px solid ${ACCENT}`, background: done ? ACCENT_TINT : BG, fontFamily: font.body, fontSize: 12, fontWeight: 500, color: ACCENT, cursor: 'pointer' }}>
                      {done ? '✓ Marked done' : 'Mark as done'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
      </div>
      )}

      {/* Documents — styled to stand out: uploads are required before the step can be completed */}
      {hasDocuments && (() => {
        const key = 'documents';
        const isOpen = openKeys.has(key);
        const allDocsUploaded = stepDocs.length > 0 && uploadedDocIds.size >= stepDocs.length;
        // Stays orange in both states — square top corners, rounded bottom — so the
        // section never reverts to the generic grey task-card treatment.
        const docCardStyle: React.CSSProperties = { border: '1px solid var(--color-terracotta-200)', borderRadius: 0, borderBottomLeftRadius: CARD_RADIUS, borderBottomRightRadius: CARD_RADIUS, background: 'var(--color-terracotta-50)', boxShadow: PANEL_SHADOW, overflow: 'hidden' };
        return (
          <div key={key} style={docCardStyle}>
            <button type="button" onClick={() => toggleOpen(key)} style={rowHeaderStyle}>
              <div style={{ ...rowIconStyle, background: allDocsUploaded ? '#DCFCE7' : 'var(--color-terracotta-100)' }}>
                <FileText size={12} color={allDocsUploaded ? GREEN : 'var(--color-terracotta-700)'} />
              </div>
              <span style={{ flex: 1, fontFamily: font.body, fontSize: 15, color: INK, lineHeight: 1.5, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                Documents needed
                <span style={{ fontFamily: font.body, fontSize: 11, color: MUTED }}>
                  ({uploadedDocIds.size > 0 ? `${uploadedDocIds.size}/${stepDocs.length} uploaded` : stepDocs.length})
                </span>
                {!allDocsUploaded && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 9px', borderRadius: PILL, background: 'var(--color-terracotta-100)', color: 'var(--color-terracotta-700)', fontFamily: font.body, fontSize: 10, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                    Required to proceed
                  </span>
                )}
              </span>
              <span style={{ flexShrink: 0, color: TEXT_TERTIARY }}>{isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</span>
            </button>
            {!allDocsUploaded && (
              <p style={{ margin: '0 18px 12px 56px', fontFamily: font.body, fontSize: 12, color: 'var(--color-terracotta-700)', lineHeight: 1.5 }}>
                Upload these documents before marking this step complete.
              </p>
            )}
            {isOpen && (
              <div style={{ padding: '0 18px 18px' }}>
                <div style={{ background: 'var(--color-terracotta-50)', borderRadius: CARD_RADIUS - 4, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6, border: '1px solid var(--color-terracotta-100)' }}>
                  {stepDocs.map((doc) => {
                    const upState = docUploadStates[doc.id] ?? 'idle';
                    const isUploaded = uploadedDocIds.has(doc.id);
                    return (
                      <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', background: BG, borderRadius: PILL, border: '1px solid var(--color-terracotta-100)', transition: 'all 150ms' }}>
                        <FileText size={13} color={isUploaded ? 'var(--color-terracotta-600)' : 'var(--color-terracotta-500)'} style={{ flexShrink: 0 }} />
                        <span style={{ fontFamily: font.body, fontSize: 13, color: INK, flex: 1, minWidth: 0 }}>{doc.name}</span>
                        {upState === 'uploading' ? (
                          <Loader2 size={13} style={{ color: 'var(--color-terracotta-500)', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
                        ) : isUploaded || upState === 'success' ? (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: font.body, fontSize: 11, fontWeight: 500, color: GREEN, flexShrink: 0 }}>
                            <Check size={12} /> Uploaded
                          </span>
                        ) : upState === 'error' ? (
                          <button type="button" onClick={() => fileInputRefs.current[doc.id]?.click()} style={{ fontFamily: font.body, fontSize: 12, fontWeight: 500, color: '#DC2626', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}>Retry</button>
                        ) : (
                          <button type="button" onClick={() => fileInputRefs.current[doc.id]?.click()} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: font.body, fontSize: 12, fontWeight: 500, color: 'var(--color-terracotta-600)', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}>
                            <UploadCloud size={12} /> Upload
                          </button>
                        )}
                        <input ref={(el) => { fileInputRefs.current[doc.id] = el; }} type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: 'none' }}
                          onChange={(e) => { const file = e.target.files?.[0]; if (file) void handleDocUpload(doc.id, doc.documentType, file); e.target.value = ''; }} />
                      </div>
                    );
                  })}
                  <p style={{ fontFamily: font.body, fontSize: 11, color: TEXT_TERTIARY, margin: '4px 4px 0', lineHeight: 1.5 }}>
                    PDF, JPG, or PNG · Max 10 MB. Uploaded files appear in your Documents tab.
                  </p>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Email drafts */}
      {hasEmail && (() => {
        const key = 'email';
        const isOpen = openKeys.has(key);
        return (
          <div key={key} style={rowCardStyle}>
            <button type="button" onClick={() => toggleOpen(key)} style={rowHeaderStyle}>
              <div style={rowIconStyle}>
                <Mail size={12} color={MUTED} />
              </div>
              <span style={{ flex: 1, fontFamily: font.body, fontSize: 15, color: INK, lineHeight: 1.5 }}>
                Email drafts <span style={{ fontFamily: font.body, fontSize: 11, color: MUTED, marginLeft: 6 }}>({templates.length})</span>
              </span>
              <span style={{ flexShrink: 0, color: TEXT_TERTIARY }}>{isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</span>
            </button>
            {isOpen && profileContext && (
              <div style={{ padding: '0 18px 18px' }}>
                <div style={{ background: ACCENT_TINT, borderRadius: CARD_RADIUS - 4, padding: '12px 16px', border: BORDER_INNER }}>
                  <EmailTemplatesSection pathwaySlug={pathwaySlug} stepNumber={stepNumber} profileContext={profileContext} />
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Official resources */}
      {hasResources && resources && (() => {
        const key = 'resources';
        const isOpen = openKeys.has(key);
        return (
          <div key={key} style={rowCardStyle}>
            <button type="button" onClick={() => toggleOpen(key)} style={rowHeaderStyle}>
              <div style={rowIconStyle}>
                <ExternalLink size={12} color={MUTED} />
              </div>
              <span style={{ flex: 1, fontFamily: font.body, fontSize: 15, color: INK, lineHeight: 1.5 }}>
                Official resources <span style={{ fontFamily: font.body, fontSize: 11, color: MUTED, marginLeft: 6 }}>({resources.length})</span>
              </span>
              <span style={{ flexShrink: 0, color: TEXT_TERTIARY }}>{isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</span>
            </button>
            {isOpen && (
              <div style={{ padding: '0 18px 18px' }}>
                <div style={{ background: ACCENT_TINT, borderRadius: CARD_RADIUS - 4, padding: '4px 8px', border: BORDER_INNER }}>
                  {resources.map((r, ri) => (
                    <a key={ri} href={r.url} target="_blank" rel="noopener noreferrer" className="subtle-link"
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: PILL, textDecoration: 'none', transition: 'background 0.1s' }}>
                      <ExternalLink size={13} style={{ color: MUTED, flexShrink: 0 }} />
                      <span style={{ fontFamily: font.body, fontSize: 13, color: INK, flex: 1, minWidth: 0 }}>{r.label}</span>
                      <ExternalLink size={11} style={{ color: MUTED, flexShrink: 0, opacity: 0.4 }} />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {checklistItems.length === 0 && !hasDocuments && !hasEmail && !hasResources && (
        <div style={{ ...rowCardStyle, padding: '20px', textAlign: 'center' }}>
          <p style={{ fontFamily: font.body, fontSize: 13, color: MUTED, margin: 0 }}>No tasks for this step.</p>
        </div>
      )}

      <AiGenerateModal isOpen={aiModal !== null} onClose={() => setAiModal(null)} title={aiModal?.modalTitle ?? ''} actionType={aiModal?.actionType ?? 'cover_letter'} stepId={stepId} />
    </div>
  );
}

// ── Pathway overview panel ────────────────────────────────────────────────────

interface OverviewPanelProps {
  pathway: ApplicationPageClientProps['pathway'];
  steps: EnrichedApplicationStep[];
  completedIds: Set<string>;
  displayCrs: number;
  onSelectStep: (id: string) => void;
}

/** Overview — shown when no step is selected. CRS score and the "what to do
 * next" shortlist live here instead of the top progress bar / sidebar. */
function OverviewPanel({ pathway, steps, completedIds, displayCrs, onSelectStep }: OverviewPanelProps) {
  const nextSteps = steps.filter((s) => !completedIds.has(s.id)).slice(0, 3);

  return (
    <div style={{ maxWidth: CONTENT_MAX_WIDTH, padding: '24px 48px 80px 72px' }}>
      <style>{`
        .pw-next-step-row:hover { background: rgba(0,0,0,0.03); }
        .pw-next-step-row:hover .pw-next-step-arrow { opacity: 1; transform: translateX(0); }
        .pw-next-step-arrow { opacity: 0; transform: translateX(-2px); transition: opacity 120ms ease, transform 120ms ease; }
      `}</style>
      <h1 style={{ fontFamily: font.display, fontSize: 38, fontWeight: 400, color: INK, margin: '0 0 8px', lineHeight: 1.15, letterSpacing: '-0.01em' }}>
        {pathway.title}
      </h1>
      {pathway.officialName && (
        <p style={{ fontFamily: font.body, fontSize: 17, color: MUTED, margin: '0 0 28px' }}>{pathway.officialName}</p>
      )}
      <div style={{ display: 'flex', gap: 14, marginBottom: pathway.description ? 32 : 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '14px 24px', borderRadius: CARD_RADIUS, background: '#FAFAFB', border: BORDER }}>
          <p style={{ fontFamily: font.body, fontSize: 11, fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', color: TEXT_TERTIARY, margin: 0 }}>Processing time</p>
          <p style={{ fontFamily: font.body, fontSize: 18, color: INK, margin: 0, fontWeight: 500 }}>{pathway.processingTime}</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '14px 24px', borderRadius: CARD_RADIUS, background: '#FAFAFB', border: BORDER }}>
          <p style={{ fontFamily: font.body, fontSize: 11, fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', color: TEXT_TERTIARY, margin: 0 }}>Total steps</p>
          <p style={{ fontFamily: font.body, fontSize: 18, color: INK, margin: 0, fontWeight: 500 }}>{pathway.totalSteps}</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '14px 24px', borderRadius: CARD_RADIUS, background: '#FAFAFB', border: BORDER }}>
          <p style={{ fontFamily: font.body, fontSize: 11, fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', color: TEXT_TERTIARY, margin: 0 }}>CRS score</p>
          <p style={{ fontFamily: font.body, fontSize: 18, color: ACCENT, margin: 0, fontWeight: 500 }}>{displayCrs}</p>
        </div>
      </div>
      {pathway.description && (
        <p style={{ fontFamily: font.body, fontSize: 17, color: '#374151', margin: '0 0 36px', lineHeight: 1.75 }}>
          {pathway.description}
        </p>
      )}

      {nextSteps.length > 0 && (
        <div style={{ marginBottom: 36 }}>
          <p style={{ fontFamily: font.body, fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: INK, margin: '0 0 12px' }}>
            What to do next
          </p>
          <div style={{ border: BORDER, borderRadius: CARD_RADIUS, overflow: 'hidden', background: BG }}>
            {nextSteps.map((step, i) => (
              <button
                key={step.id}
                type="button"
                onClick={() => onSelectStep(step.id)}
                className="pw-next-step-row"
                style={{
                  display: 'flex', alignItems: 'center', gap: 14, width: '100%',
                  padding: '16px 20px',
                  background: 'none', border: 'none',
                  borderBottom: i < nextSteps.length - 1 ? BORDER_INNER : 'none',
                  cursor: 'pointer', textAlign: 'left',
                  transition: 'background 120ms ease',
                }}
              >
                <SidebarStepIcon completed={false} label={step.label} />
                <span style={{ flex: 1, fontFamily: font.body, fontSize: 15, color: INK }}>{step.label}</span>
                <ChevronRight size={16} className="pw-next-step-arrow" style={{ flexShrink: 0, color: ACCENT }} />
              </button>
            ))}
          </div>
        </div>
      )}

      <Link href="/onboarding/matches"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '13px 28px',
          borderRadius: PILL,
          border: `1.5px solid ${ACCENT}`,
          fontFamily: font.body, fontSize: 14, fontWeight: 600,
          letterSpacing: '0.04em', textTransform: 'uppercase',
          color: ACCENT, textDecoration: 'none',
          transition: 'background 120ms ease',
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = ACCENT_TINT; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = 'none'; }}>
        Change pathway →
      </Link>
    </div>
  );
}

// ── Step detail panel ─────────────────────────────────────────────────────────

interface StepDetailPanelProps {
  step: EnrichedApplicationStep;
  documents: DashboardDocument[];
  pathwaySlug: string;
  profileContext: ProfileContext | null;
  isCompleted: boolean;
  isPending: boolean;
  docsReady: boolean;
  actionError: string | null;
  hasNextStep: boolean;
  onMarkComplete: () => void;
  onMarkIncomplete: () => void;
  onGoToOverview: () => void;
  onGoToNext: () => void;
  onAllChecked?: () => void;
  onDocumentsReadyChange?: (ready: boolean) => void;
}

/** Step detail — plain heading + description, then the accordion task list,
 * then the complete / navigate actions at the bottom of the page. */
function StepDetailPanel({
  step, documents, pathwaySlug, profileContext,
  isCompleted, isPending, docsReady, actionError, hasNextStep,
  onMarkComplete, onMarkIncomplete, onGoToOverview, onGoToNext,
  onAllChecked, onDocumentsReadyChange,
}: StepDetailPanelProps) {
  const { ref: scrollRef, faded } = useScrollFade();
  const [, setCheckedCount] = useState(0);
  const handleCheckedChange = useCallback((n: number) => { setCheckedCount(n); }, []);
  const stepDocs = documents.filter((d) => documentBelongsToStep(d.name, step.stepNumber));

  const checklistItems = step.checklistItems ?? [];

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div className="pw-scroll-fade" data-faded={faded} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <div ref={scrollRef} className="pw-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          <div style={{ maxWidth: CONTENT_MAX_WIDTH, padding: '24px 48px 80px 72px', display: 'flex', flexDirection: 'column', gap: 24 }}>

            {/* Heading + description — plain text, no container */}
            <div>
              <h1 style={{ fontFamily: font.display, fontSize: 28, fontWeight: 500, color: INK, margin: '0 0 14px', lineHeight: 1.25, letterSpacing: '-0.01em' }}>
                {step.label}
              </h1>
              {step.description && (
                <p style={{ fontFamily: font.body, fontSize: 16, color: '#374151', margin: 0, lineHeight: 1.7 }}>
                  {step.description}
                </p>
              )}
            </div>

            {/* Tasks accordion */}
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
              onDocumentsReadyChange={onDocumentsReadyChange}
            />

            {/* Complete / navigate actions — bottom of the page, reached by scrolling */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 8 }}>
              {actionError && (
                <p style={{ fontFamily: font.body, fontSize: 12, color: '#DC2626', margin: 0 }}>{actionError}</p>
              )}
              <div style={{ display: 'flex', gap: 10 }}>
                {isCompleted ? (
                  <button type="button" onClick={onMarkIncomplete} disabled={isPending}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '13px 22px', borderRadius: PILL, border: '1px solid #E7E5EC', background: BG, fontFamily: font.body, fontSize: 14, fontWeight: 500, color: MUTED, cursor: isPending ? 'not-allowed' : 'pointer' }}>
                    Mark incomplete
                  </button>
                ) : (
                  <button type="button" onClick={onMarkComplete} disabled={isPending || !docsReady}
                    title={!docsReady ? 'Upload the required documents first' : undefined}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '13px 22px', borderRadius: PILL,
                      background: '#FFFFFF',
                      color: isPending || !docsReady ? '#B0B8C1' : ACCENT,
                      border: `1.5px solid ${isPending || !docsReady ? '#D8DCE1' : ACCENT}`,
                      fontFamily: font.body, fontSize: 14, fontWeight: 600,
                      cursor: isPending || !docsReady ? 'not-allowed' : 'pointer',
                    }}>
                    {isPending && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
                    {isPending ? 'Saving…' : !docsReady ? 'Upload documents to continue' : 'Mark as complete'}
                  </button>
                )}
                <button type="button" onClick={onGoToOverview}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '13px 20px', borderRadius: PILL, border: '1.5px solid #E7E5EC', background: BG, fontFamily: font.body, fontSize: 14, fontWeight: 500, color: INK, cursor: 'pointer' }}>
                  ← Overview
                </button>
                {hasNextStep && (
                  <button type="button" onClick={onGoToNext}
                    disabled={!isCompleted} title={!isCompleted ? 'Complete this step first' : undefined}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '13px 20px', borderRadius: PILL, background: isCompleted ? INK : BG, color: isCompleted ? '#FFFFFF' : MUTED, border: isCompleted ? 'none' : '1.5px solid #E7E5EC', fontFamily: font.body, fontSize: 14, fontWeight: 500, cursor: isCompleted ? 'pointer' : 'not-allowed' }}>
                    Next →
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

/** Application page — unified bordered container with top strip + sidebar | content layout. */
export function ApplicationPageClient({
  pathway,
  steps,
  profileContext,
  documents,
  crsScore,
  onBack,
}: ApplicationPageClientProps) {
  const { ref: overviewScrollRef, faded: overviewFaded } = useScrollFade();
  const [selectedId, setSelectedId] = useState<string>('overview');
  const [completedIds, setCompletedIds] = useState<Set<string>>(
    () => new Set(steps.filter((s) => s.status === 'complete').map((s) => s.id))
  );
  const [isPending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);

  const selectedStep = steps.find((s) => s.id === selectedId) ?? null;
  const completedCount = completedIds.size;
  const progressPct = steps.length > 0 ? Math.round((completedCount / steps.length) * 100) : 0;

  const currentStepIdx = selectedStep ? steps.findIndex((s) => s.id === selectedStep.id) : -1;
  const nextStep = currentStepIdx >= 0 && currentStepIdx < steps.length - 1 ? steps[currentStepIdx + 1] : null;
  const isCurrentStepCompleted = selectedStep ? completedIds.has(selectedStep.id) : false;

  // Documents-uploaded gate — a step with required documents can't be marked
  // complete until all of them are uploaded. Seeded from persisted status on
  // step switch; AccordionChecklist reports live (in-session) uploads on top.
  const computeDocsReady = useCallback((step: EnrichedApplicationStep | null) => {
    if (!step) return true;
    const stepDocs = documents.filter((d) => documentBelongsToStep(d.name, step.stepNumber));
    return stepDocs.length === 0 || stepDocs.every((d) => d.status === 'uploaded' || d.status === 'verified');
  }, [documents]);
  const [docsReady, setDocsReady] = useState(() => computeDocsReady(selectedStep));

  const autoAdvanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearAutoAdvance = () => {
    if (autoAdvanceRef.current) { clearTimeout(autoAdvanceRef.current); autoAdvanceRef.current = null; }
  };

  const handleSelectStep = (id: string) => {
    clearAutoAdvance();
    setSelectedId(id);
    setDocsReady(computeDocsReady(steps.find((s) => s.id === id) ?? null));
  };

  useEffect(() => () => { if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current); }, []);

  const handleMarkComplete = (stepId: string) => setCompletedIds((prev) => new Set([...prev, stepId]));
  const handleMarkIncomplete = (stepId: string) => {
    setCompletedIds((prev) => { const next = new Set(prev); next.delete(stepId); return next; });
  };

  const scheduleAutoAdvance = (fromId: string) => {
    const idx = steps.findIndex((s) => s.id === fromId);
    if (idx < 0) return;
    let nextId: string | null = null;
    for (let i = idx + 1; i < steps.length; i++) {
      if (!completedIds.has(steps[i].id)) { nextId = steps[i].id; break; }
    }
    if (nextId === null) return;
    const target = nextId;
    clearAutoAdvance();
    autoAdvanceRef.current = setTimeout(() => { autoAdvanceRef.current = null; setSelectedId(target); }, 800);
  };

  const handleMutateComplete = (onSuccess?: () => void) => {
    if (!selectedStep) return;
    if (!docsReady) { setActionError('Upload the required documents before completing this step.'); return; }
    setActionError(null);
    startTransition(async () => {
      try {
        await updateStepProgress({ stepId: selectedStep.id, pathwaySlug: pathway.slug, status: 'complete' });
        handleMarkComplete(selectedStep.id);
        onSuccess?.();
      } catch {
        setActionError('Failed to save. Please try again.');
      }
    });
  };

  const handleMutateIncomplete = () => {
    if (!selectedStep) return;
    setActionError(null);
    startTransition(async () => {
      try {
        await updateStepProgress({ stepId: selectedStep.id, pathwaySlug: pathway.slug, status: 'upcoming' });
        handleMarkIncomplete(selectedStep.id);
      } catch {
        setActionError('Failed to save. Please try again.');
      }
    });
  };

  const handleAutoComplete = () => {
    if (completedIds.has(selectedId)) return;
    if (!docsReady) return;
    flushAllChecklists();
    handleMutateComplete(() => scheduleAutoAdvance(selectedId));
  };

  // CRS display — show computed score, or 450 as demo placeholder
  const displayCrs = crsScore ?? 450;

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0, background: PAGE_BG }}>

        {/* ── Left sidebar — floated off the screen edge, no divider from the content area ── */}
        <div style={{ width: 252, flexShrink: 0, margin: '24px 0 24px 28px', display: 'flex', flexDirection: 'column', overflow: 'visible', background: BG }}>

            {/* Minimal back button — returns to the applications-home list. Replaces
                the old pathway dropdown; inset matches the Overview button below it. */}
            <div style={{ padding: '10px 10px 6px', flexShrink: 0 }}>
              <button
                type="button"
                onClick={onBack}
                className="pw-back-btn"
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 10px 8px 6px',
                  background: 'none', border: 'none', borderRadius: 10,
                  cursor: 'pointer',
                  fontFamily: font.body, fontSize: 13, fontWeight: 500,
                  color: MUTED,
                }}
              >
                <ArrowLeft size={15} style={{ flexShrink: 0 }} />
                Back to applications
              </button>
            </div>

            <div className="pw-scroll" style={{ flex: 1, overflowY: 'auto' }}>
              <nav style={{ padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 8 }}>

                {/* Overview button — rounded blue pill matching the "Change pathway"
                    CTA on the overview page: persistent accent border, always-blue
                    icon/text, tinted fill on hover/selected. */}
                <button
                  type="button"
                  onClick={() => handleSelectStep('overview')}
                  className={`app-sidebar-item app-sidebar-item--cta${selectedId === 'overview' ? ' is-selected' : ''}`}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '13px 14px 13px 6px', cursor: 'pointer', textAlign: 'left' }}
                >
                  <Home size={15} color={ACCENT} style={{ flexShrink: 0 }} />
                  <span style={{ flex: 1, minWidth: 0, fontFamily: font.body, fontSize: 11, fontWeight: 600, letterSpacing: '0.02em', textTransform: 'uppercase', color: ACCENT, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    Pathway overview
                  </span>
                  <ChevronRight size={13} className="item-arrow" style={{ flexShrink: 0, color: ACCENT }} />
                </button>

                {/* Steps label — aligned with the Pathway/Overview inset above it;
                    the step rows below are indented further than this baseline. */}
                <span style={{ fontFamily: font.body, fontSize: 10, fontWeight: 600, letterSpacing: '0.10em', color: INK, textTransform: 'uppercase', margin: '18px 6px 4px' }}>Steps</span>

                {steps.map((step) => {
                  const isSelected = selectedId === step.id;
                  const isComplete = completedIds.has(step.id);
                  return (
                    <button
                      key={step.id}
                      type="button"
                      onClick={() => handleSelectStep(step.id)}
                      className={`app-sidebar-item${isSelected ? ' is-selected' : ''}`}
                      style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', padding: '9px 12px 9px 16px', cursor: 'pointer', textAlign: 'left', minHeight: 40 }}
                    >
                      <div className="item-icon" style={{ flexShrink: 0 }}>
                        <SidebarStepIcon completed={isComplete} label={step.label} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p className="item-label" style={{ fontFamily: font.body, fontSize: 12, fontWeight: isSelected ? 500 : 400, margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.4 }}>
                          {step.label}
                        </p>
                      </div>
                      <ChevronRight size={13} className="item-arrow" style={{ flexShrink: 0, color: '#9CA3AF' }} />
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>

        {/* ── Main content area — flush under the header, no raised container ── */}
        <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', background: BG }}>

          {/* Progress / CRS — sits at the top of the content area, no container. Spans
              the full width of the main view; its left edge matches the content below. */}
          <div style={{ padding: '24px 48px 16px 72px', flexShrink: 0 }}>
           <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>

            {/* Progress bar — fills the remaining middle space, no container */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 16, minWidth: 0 }}>
              <span style={{ fontFamily: font.display, fontSize: 26, fontWeight: 600, color: INK, whiteSpace: 'nowrap', flexShrink: 0, letterSpacing: '-0.01em' }}>
                {progressPct}%
              </span>
              {/* Segmented — one bar per pathway step, filled for completed steps */}
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
                {steps.map((step) => {
                  const filled = completedIds.has(step.id);
                  return (
                    <div
                      key={step.id}
                      title={step.label}
                      style={{
                        flex: 1,
                        height: 8,
                        borderRadius: PILL,
                        background: filled ? (progressPct === 100 ? '#16A34A' : PROGRESS_TEAL) : '#EEEDF2',
                        transition: 'background 300ms ease',
                      }}
                    />
                  );
                })}
              </div>
              <span style={{ fontFamily: font.body, fontSize: 13, color: MUTED, whiteSpace: 'nowrap', flexShrink: 0 }}>
                Step {Math.min(completedCount + 1, steps.length)} of {steps.length}
              </span>
            </div>
           </div>
          </div>

          {selectedId === 'overview' || selectedStep === null ? (
            <div className="pw-scroll-fade" data-faded={overviewFaded} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <div ref={overviewScrollRef} className="pw-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
                <OverviewPanel pathway={pathway} steps={steps} completedIds={completedIds} displayCrs={displayCrs} onSelectStep={handleSelectStep} />
              </div>
            </div>
          ) : (
            <StepDetailPanel
              key={selectedStep.id}
              step={selectedStep}
              documents={documents}
              pathwaySlug={pathway.slug}
              profileContext={profileContext}
              isCompleted={isCurrentStepCompleted}
              isPending={isPending}
              docsReady={docsReady}
              actionError={actionError}
              hasNextStep={nextStep !== null}
              onMarkComplete={() => handleMutateComplete()}
              onMarkIncomplete={handleMutateIncomplete}
              onGoToOverview={() => handleSelectStep('overview')}
              onGoToNext={() => { if (isCurrentStepCompleted && nextStep) handleSelectStep(nextStep.id); }}
              onAllChecked={handleAutoComplete}
              onDocumentsReadyChange={setDocsReady}
            />
          )}
        </div>

      <style>{`
        .app-sidebar-item {
          background: transparent;
          border: none;
          border-radius: 12px;
          transition: background 120ms ease;
        }
        .app-sidebar-item.is-selected {
          background: rgba(26,86,219,0.08);
        }
        .app-sidebar-item:not(.is-selected):hover {
          background: rgba(0,0,0,0.04);
        }
        .app-sidebar-item:active {
          background: rgba(26,86,219,0.12) !important;
        }
        .app-sidebar-item .item-label { color: #0A0A0A; transition: color 120ms ease; }
        .app-sidebar-item.is-selected .item-label { color: #1A56DB; font-weight: 500; }
        .app-sidebar-item:not(.is-selected):hover .item-label { color: #1e3a8a; }
        .app-sidebar-item .item-arrow { opacity: 0; transform: translateX(-2px); transition: opacity 120ms ease, transform 120ms ease; }
        .app-sidebar-item:hover .item-arrow { opacity: 1; transform: translateX(0); }

        /* CTA pill — the Overview button matches the "Change pathway" button's
           rounded blue styling: persistent accent border, tinted fill on hover/select. */
        .app-sidebar-item--cta {
          border-radius: 999px;
          border: 1.5px solid #1A56DB;
          background: transparent;
        }
        .app-sidebar-item--cta:not(.is-selected):hover {
          background: rgba(26,86,219,0.08);
        }
        .app-sidebar-item--cta.is-selected {
          background: rgba(26,86,219,0.10);
        }

        .pw-back-btn:hover { background: rgba(0,0,0,0.05); color: #1e3a8a; }
        .pw-back-btn:active { background: rgba(0,0,0,0.08); }

        .task-cb {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 16px;
          height: 16px;
          border: 1.5px solid #D1D5DB;
          border-radius: 3px;
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

        .subtle-link { transition: opacity 100ms ease; }
        .subtle-link:hover { opacity: 0.7; text-decoration: underline; text-decoration-color: rgba(26,86,219,0.40); text-underline-offset: 2px; }
        .subtle-link:active { opacity: 0.5; }

        .checklist-input:focus { border-color: rgba(26,86,219,0.50) !important; box-shadow: 0 0 0 3px rgba(26,86,219,0.10); }
      `}</style>
    </div>
  );
}
