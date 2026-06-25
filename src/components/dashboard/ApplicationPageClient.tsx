'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Check, Loader2, Clock, Home, ExternalLink } from 'lucide-react';
import { updateStepProgress } from '@/app/actions/progress';
import {
  SectionLabel,
  SectionDivider,
  ChecklistSection,
  ProTipsSection,
  DocumentsSection,
  ResourcesSection,
  EmailTemplatesSection,
  CoverLetterSection,
} from '@/components/dashboard/StepDetailDrawer';
import { documentBelongsToStep } from '@/lib/step-document-map';
import { getEmailTemplates } from '@/lib/email-templates';
import { CheckmarkDraw } from '@/components/fx/CheckmarkDraw';
import { ParticleBurst } from '@/components/fx/ParticleBurst';
import type { EnrichedApplicationStep, DashboardDocument, ProfileContext } from '@/modules/dashboard/types';

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

const ink = '#0A0A0A';
const muted = '#6B7280';
const border = '#E5E5E5';
const font = {
  body: 'var(--pw-font-body)' as const,
  display: 'var(--pw-font-display)' as const,
};

// ── Step status circle (sidebar size) ─────────────────────────────────────────

type StepStatus = 'complete' | 'current' | 'upcoming';

function SidebarStepCircle({ status, stepNumber }: { status: StepStatus; stepNumber: number }) {
  if (status === 'complete') {
    return (
      <div style={{
        width: 20, height: 20, borderRadius: '50%',
        background: ink, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
          <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    );
  }
  if (status === 'current') {
    return (
      <div style={{
        width: 20, height: 20, borderRadius: '50%',
        border: `1.5px solid ${ink}`,
        background: 'transparent', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: ink, fontFamily: font.body, fontSize: 10,
      }}>
        {stepNumber}
      </div>
    );
  }
  return (
    <div style={{
      width: 20, height: 20, borderRadius: '50%',
      border: '1.5px solid #D1D5DB',
      background: 'transparent', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#9CA3AF', fontFamily: font.body, fontSize: 10,
    }}>
      {stepNumber}
    </div>
  );
}

// ── Pathway overview panel ────────────────────────────────────────────────────

interface OverviewPanelProps {
  pathway: ApplicationPageClientProps['pathway'];
}

/** Renders the pathway summary — shown when "Pathway Overview" is selected. */
function OverviewPanel({ pathway }: OverviewPanelProps) {
  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '36px 52px 36px 56px' }}>
      <p style={{
        fontFamily: font.body, fontSize: 10, fontWeight: 500,
        letterSpacing: '0.12em', color: '#9CA3AF', textTransform: 'uppercase',
        margin: '0 0 12px',
      }}>
        Your Pathway
      </p>
      <h1 style={{
        fontFamily: font.display, fontSize: 28, fontWeight: 400,
        color: ink, margin: '0 0 4px', lineHeight: 1.2,
      }}>
        {pathway.title}
      </h1>
      {pathway.officialName && (
        <p style={{ fontFamily: font.body, fontSize: 13, color: muted, margin: '0 0 20px' }}>
          {pathway.officialName}
        </p>
      )}
      <hr style={{ border: 'none', borderTop: `1px solid ${border}`, margin: '0 0 20px' }} />
      <div style={{ display: 'flex', gap: 40, marginBottom: pathway.description ? 20 : 0 }}>
        <div>
          <p style={{
            fontFamily: font.body, fontSize: 10, fontWeight: 500,
            letterSpacing: '0.1em', color: '#9CA3AF', textTransform: 'uppercase',
            margin: '0 0 4px',
          }}>
            Processing Time
          </p>
          <p style={{ fontFamily: font.body, fontSize: 14, color: ink, margin: 0 }}>
            {pathway.processingTime}
          </p>
        </div>
        <div>
          <p style={{
            fontFamily: font.body, fontSize: 10, fontWeight: 500,
            letterSpacing: '0.1em', color: '#9CA3AF', textTransform: 'uppercase',
            margin: '0 0 4px',
          }}>
            Total Steps
          </p>
          <p style={{ fontFamily: font.body, fontSize: 14, color: ink, margin: 0 }}>
            {pathway.totalSteps}
          </p>
        </div>
      </div>
      {pathway.description && (
        <p style={{
          fontFamily: font.body, fontSize: 14, color: '#374151',
          margin: '0 0 28px', lineHeight: 1.7, maxWidth: 560,
        }}>
          {pathway.description}
        </p>
      )}
      <Link
        href="/onboarding/matches"
        style={{ fontFamily: font.body, fontSize: 13, color: ink, textDecoration: 'none', opacity: 0.7 }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.opacity = '1'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.opacity = '0.7'; }}
      >
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
  onMarkComplete: (stepId: string) => void;
  onMarkIncomplete: (stepId: string) => void;
}

/** Renders full step detail inline — header, all sections, sticky mark-complete footer. */
function StepDetailPanel({
  step,
  documents,
  pathwaySlug,
  profileContext,
  isCompleted,
  onMarkComplete,
  onMarkIncomplete,
}: StepDetailPanelProps) {
  const [isPending, startTransition] = useTransition();
  const [justCompleted, setJustCompleted] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const stepDocs = documents.filter((d) => documentBelongsToStep(d.name, step.stepNumber));
  const hasDocuments   = stepDocs.length > 0;
  const hasResources   = (step.resources?.length ?? 0) > 0;
  const templates      = getEmailTemplates(pathwaySlug, step.stepNumber);
  const hasTemplates   = templates.length > 0;
  const showCoverLetter = step.stepNumber >= 3 && step.stepNumber <= 5;
  const hasChecklist   = (step.checklistItems?.length ?? 0) > 0;
  const hasProTips     = !!step.proTips;
  const hasOfficialUrl = !!step.officialUrl;

  const handleMarkComplete = () => {
    setActionError(null);
    startTransition(async () => {
      try {
        await updateStepProgress({ stepId: step.id, pathwaySlug, status: 'complete' });
        setJustCompleted(true);
        onMarkComplete(step.id);
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

  const statusStyles = {
    upcoming: { bg: '#F3F4F6', color: muted,     label: 'Upcoming'    },
    current:  { bg: '#F3F4F6', color: ink,       label: 'In Progress' },
    complete: { bg: '#F0FDF4', color: '#16A34A', label: 'Complete'    },
  } as const;
  const ss = statusStyles[isCompleted ? 'complete' : step.status];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '36px 52px 36px 56px' }}>

        {/* Step header */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 28, height: 28, borderRadius: '50%',
              background: '#F3F4F6', color: muted,
              fontFamily: font.body, fontSize: 12, fontWeight: 500, flexShrink: 0,
            }}>
              {step.stepNumber}
            </span>
            <h1 style={{
              fontFamily: font.display, fontSize: 22, fontWeight: 400,
              color: ink, margin: 0, lineHeight: 1.3,
            }}>
              {step.label}
            </h1>
          </div>

          {/* Metadata badges */}
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
                Est.{' '}
                {step.estimatedDaysMin != null && step.estimatedDaysMax != null
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
            {step.formNumbers?.map((f) => (
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
            <p style={{
              fontFamily: font.body, fontSize: 14, color: '#374151',
              margin: '14px 0 0', lineHeight: 1.65, maxWidth: 600,
            }}>
              {step.description}
            </p>
          )}
        </div>

        <hr style={{ border: 'none', borderTop: `1px solid ${border}`, margin: '0 0 4px' }} />

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
                padding: '8px 16px', borderRadius: 9999,
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

        {hasTemplates && profileContext && (
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
          <div style={{ paddingTop: 20, paddingBottom: 24 }}>
            <SectionLabel>Cover Letter</SectionLabel>
            <CoverLetterSection step={step} pathwaySlug={pathwaySlug} />
          </div>
        )}
      </div>

      {/* Sticky footer — mark complete / incomplete */}
      <div style={{
        padding: '12px 52px 12px 56px',
        borderTop: `1px solid ${border}`,
        flexShrink: 0,
        background: '#FFFFFF',
      }}>
        {actionError && (
          <p style={{ fontFamily: font.body, fontSize: 12, color: '#DC2626', marginBottom: 8 }}>
            {actionError}
          </p>
        )}
        {isCompleted ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              position: 'relative', flex: 1,
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 16px', borderRadius: 9999,
              background: '#F0FDF4', color: '#16A34A',
              fontFamily: font.body, fontSize: 13, fontWeight: 500,
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
              type="button"
              onClick={handleMarkIncomplete}
              disabled={isPending}
              className="app-incomplete-btn"
              style={{
                flexShrink: 0,
                display: 'inline-flex', alignItems: 'center',
                padding: '8px 16px', borderRadius: 9999,
                border: `1px solid ${border}`, background: '#FFFFFF',
                fontFamily: font.body, fontSize: 12, fontWeight: 500,
                color: muted, cursor: isPending ? 'not-allowed' : 'pointer',
              }}
            >
              Mark incomplete
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleMarkComplete}
            disabled={isPending}
            className="app-complete-btn"
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '10px 24px', borderRadius: 9999,
              background: isPending ? '#E5E7EB' : ink,
              color: isPending ? muted : '#FFFFFF',
              fontFamily: font.body, fontSize: 13, fontWeight: 500,
              border: 'none', cursor: isPending ? 'not-allowed' : 'pointer',
            }}
          >
            {isPending && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
            {isPending ? 'Saving…' : 'Mark as complete →'}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

/** Two-column application page: left step checklist + right inline detail panel. */
export function ApplicationPageClient({
  pathway,
  steps,
  profileContext,
  documents,
}: ApplicationPageClientProps) {
  const [selectedId, setSelectedId] = useState<string>('overview');
  const [completedIds, setCompletedIds] = useState<Set<string>>(
    () => new Set(steps.filter((s) => s.status === 'complete').map((s) => s.id))
  );

  const handleMarkComplete = (stepId: string) => {
    setCompletedIds((prev) => new Set([...prev, stepId]));
  };

  const handleMarkIncomplete = (stepId: string) => {
    setCompletedIds((prev) => {
      const next = new Set(prev);
      next.delete(stepId);
      return next;
    });
  };

  const selectedStep = steps.find((s) => s.id === selectedId) ?? null;

  const completedCount = completedIds.size;
  const progressPct = steps.length > 0 ? Math.round((completedCount / steps.length) * 100) : 0;

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

      {/* ─── Left sidebar — floating card ─── */}
      <div style={{ flexShrink: 0, padding: '16px 12px 16px 24px', display: 'flex', alignItems: 'stretch' }}>
        <div style={{
          width: 310,
          background: '#FFFFFF',
          borderRadius: 14,
          border: '1px solid rgba(0,0,0,0.08)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.09), 0 1px 6px rgba(0,0,0,0.05)',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}>

          {/* ── Pathway header ── */}
          <div style={{ padding: '18px 16px 16px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
            <p style={{
              fontFamily: font.body, fontSize: 9, fontWeight: 600,
              letterSpacing: '0.12em', color: '#B0B0B0', textTransform: 'uppercase',
              margin: '0 0 7px',
            }}>
              Active Pathway
            </p>
            <p style={{
              fontFamily: font.display, fontSize: 16,
              color: ink, margin: '0 0 2px', lineHeight: 1.25,
            }}>
              {pathway.title}
            </p>
            {pathway.officialName && (
              <p style={{ fontFamily: font.body, fontSize: 11, color: muted, margin: '0 0 12px', lineHeight: 1.4 }}>
                {pathway.officialName}
              </p>
            )}
            {/* Info chips */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center',
                padding: '2px 8px', borderRadius: 9999,
                background: '#F3F4F6', border: '1px solid rgba(0,0,0,0.07)',
                fontFamily: font.body, fontSize: 10, color: muted,
              }}>
                {pathway.processingTime}
              </span>
              <span style={{
                display: 'inline-flex', alignItems: 'center',
                padding: '2px 8px', borderRadius: 9999,
                background: '#F3F4F6', border: '1px solid rgba(0,0,0,0.07)',
                fontFamily: font.body, fontSize: 10, color: muted,
              }}>
                {pathway.totalSteps} steps
              </span>
            </div>
            {/* Progress bar */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                <span style={{ fontFamily: font.body, fontSize: 10, color: muted }}>
                  {completedCount} of {steps.length} complete
                </span>
                {completedCount > 0 && (
                  <span style={{ fontFamily: font.body, fontSize: 10, color: ink, fontWeight: 500 }}>
                    {progressPct}%
                  </span>
                )}
              </div>
              <div style={{ height: 3, borderRadius: 9999, background: '#EBEBEB', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${progressPct}%`,
                  background: ink,
                  borderRadius: 9999,
                  transition: 'width 400ms cubic-bezier(0.16,1,0.3,1)',
                  minWidth: completedCount > 0 ? 6 : 0,
                }} />
              </div>
            </div>
          </div>

          {/* ── Nav list ── */}
          <nav style={{ padding: '10px 8px 10px', flex: 1 }}>

            {/* Overview — home button, visually distinct */}
            <button
              type="button"
              onClick={() => setSelectedId('overview')}
              className={`app-sidebar-item${selectedId === 'overview' ? ' is-selected' : ''}`}
              style={{
                display: 'flex', alignItems: 'center', gap: 9,
                width: '100%', padding: '9px 10px',
                cursor: 'pointer', textAlign: 'left',
              }}
            >
              <div
                className="item-icon"
                style={{
                  width: 24, height: 24, borderRadius: 7, flexShrink: 0,
                  background: selectedId === 'overview' ? '#E8E8E8' : '#F3F4F6',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background 150ms ease',
                }}
              >
                <Home size={12} color={selectedId === 'overview' ? ink : '#9CA3AF'} />
              </div>
              <span className="item-label" style={{
                fontFamily: font.body, fontSize: 13,
                fontWeight: selectedId === 'overview' ? 500 : 400,
              }}>
                Pathway Overview
              </span>
            </button>

            {/* Steps section divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '10px 4px 6px' }}>
              <span style={{
                fontFamily: font.body, fontSize: 9, fontWeight: 600,
                letterSpacing: '0.10em', color: '#C8C8C8', textTransform: 'uppercase',
                flexShrink: 0,
              }}>
                Steps
              </span>
              <div style={{ flex: 1, height: 1, background: 'rgba(0,0,0,0.06)' }} />
            </div>

            {/* Step items */}
            {steps.map((step) => {
              const isSelected = selectedId === step.id;
              const effectiveStatus: StepStatus = completedIds.has(step.id) ? 'complete' : step.status;

              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => setSelectedId(step.id)}
                  className={`app-sidebar-item${isSelected ? ' is-selected' : ''}`}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 9,
                    width: '100%', padding: '8px 10px',
                    cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  <div className="item-icon" style={{ flexShrink: 0 }}>
                    <SidebarStepCircle status={effectiveStatus} stepNumber={step.stepNumber} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p className="item-label" style={{
                      fontFamily: font.body, fontSize: 13,
                      fontWeight: isSelected ? 500 : 400,
                      margin: 0,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {step.label}
                    </p>
                    {step.estimatedDuration && (
                      <p style={{ fontFamily: font.body, fontSize: 11, color: '#A0A0A0', margin: '1px 0 0' }}>
                        {step.estimatedDuration}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* ─── Right content panel ─── */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#FFFFFF' }}>
        {selectedId === 'overview' || selectedStep === null ? (
          <OverviewPanel pathway={pathway} />
        ) : (
          <StepDetailPanel
            key={selectedStep.id}
            step={selectedStep}
            documents={documents}
            pathwaySlug={pathway.slug}
            profileContext={profileContext}
            isCompleted={completedIds.has(selectedStep.id)}
            onMarkComplete={handleMarkComplete}
            onMarkIncomplete={handleMarkIncomplete}
          />
        )}
      </div>

      <style>{`
        /* ── Sidebar nav items — clean B&W outline style ── */
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
        .app-sidebar-item:active {
          background: rgba(0,0,0,0.07);
        }
        /* Item label color */
        .app-sidebar-item .item-label {
          color: #6B7280;
          transition: color 100ms ease;
        }
        .app-sidebar-item.is-selected .item-label {
          color: #0A0A0A;
        }
        .app-sidebar-item:not(.is-selected):hover .item-label {
          color: #374151;
        }
        /* Icon micro-pop */
        .app-sidebar-item .item-icon {
          transition: transform 150ms cubic-bezier(0.16,1,0.3,1);
        }
        .app-sidebar-item:hover .item-icon {
          transform: scale(1.10);
        }
        .app-sidebar-item:active .item-icon {
          transform: scale(1.0);
        }
        /* ── Mark complete button ── */
        .app-complete-btn {
          transition: opacity 120ms ease, transform 120ms ease;
        }
        .app-complete-btn:hover:not(:disabled) {
          opacity: 0.86;
          transform: translateY(-1px);
        }
        .app-complete-btn:active:not(:disabled) {
          opacity: 1;
          transform: translateY(0);
        }
        /* ── Mark incomplete button ── */
        .app-incomplete-btn {
          transition: color 120ms ease, border-color 120ms ease;
        }
        .app-incomplete-btn:hover:not(:disabled) {
          color: #374151 !important;
          border-color: #9CA3AF !important;
        }
        @keyframes spin { from { transform:rotate(0deg) } to { transform:rotate(360deg) } }
      `}</style>
    </div>
  );
}
