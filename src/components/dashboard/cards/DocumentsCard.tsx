import Link from 'next/link';
import { Lock, CheckCircle2 } from 'lucide-react';
import type { DashboardData, DashboardDocument } from '@/modules/dashboard/types';

interface DocumentsCardProps {
  data: DashboardData;
}

function LockedVariant({ reason }: { reason: string }) {
  return (
    <>
      <h2 className="card-title mb-3">Documents</h2>
      <div className="flex flex-col items-center justify-center py-4 gap-2">
        <Lock size={24} className="text-text-disabled" />
        <p className="text-text-tertiary text-center" style={{ fontSize: '12px' }}>{reason}</p>
      </div>
    </>
  );
}

/** Status dot color for a document status value. */
function statusDotColor(status: string): string {
  if (status === 'verified') return '#22C55E';
  if (status === 'uploaded') return '#0FA896';
  if (status === 'rejected') return '#EF4444';
  return '#F59E0B';
}

function ApplicationInProgressVariant({ data }: DocumentsCardProps) {
  const pendingDocs = data.documents.filter(
    (d) => d.isMandatory && d.status !== 'uploaded' && d.status !== 'verified'
  );
  const topPending = pendingDocs.slice(0, 3);
  const allComplete = pendingDocs.length === 0 && data.documents.length > 0;

  // Vertical offsets for the Apple Wallet stacked chip effect.
  // Using inline styles here because Tailwind cannot generate dynamic translate values.
  const chipOffsets = ['0px', '6px', '12px'] as const;

  return (
    <>
      <h2 className="card-title">Documents</h2>
      <p className="text-text-secondary mt-1" style={{ fontSize: '13px', fontWeight: 500 }}>
        {data.pendingDocumentsCount} pending&nbsp;&nbsp;·&nbsp;&nbsp;{data.completedDocumentsCount} complete
      </p>

      {allComplete ? (
        <div className="flex items-center gap-2 mt-3">
          <CheckCircle2 size={18} className="text-accent-500" />
          <p className="text-text-secondary" style={{ fontSize: '13px' }}>All documents complete</p>
        </div>
      ) : topPending.length > 0 ? (
        /* Apple Wallet stacked chips */
        <div className="relative mt-3" style={{ height: `${32 + (topPending.length - 1) * 6}px` }}>
          {topPending.map((doc: DashboardDocument, i: number) => (
            <div
              key={doc.id}
              className="absolute left-0 right-0 flex items-center justify-between px-3 py-1.5 bg-bg-surface rounded-badge border border-border-light"
              style={{
                top: chipOffsets[i as 0 | 1 | 2] ?? '0px',
                zIndex: topPending.length - i,
                boxShadow: 'var(--shadow-card)',
                height: 32,
              }}
            >
              <span className="truncate text-text-primary" style={{ fontSize: '12px' }}>
                {doc.name}
              </span>
              <span
                className="w-1.5 h-1.5 rounded-full flex-shrink-0 ml-2"
                style={{ background: statusDotColor(doc.status) }}
              />
            </div>
          ))}
        </div>
      ) : null}

      {data.applicationId && (
        <div className="mt-4">
          <Link
            href={`/applications/${data.applicationId}/documents`}
            className="text-accent-600"
            style={{ fontSize: '13px', fontWeight: 600 }}
          >
            View all →
          </Link>
        </div>
      )}
    </>
  );
}

function ApplicationSubmittedVariant({ data }: DocumentsCardProps) {
  return (
    <>
      <h2 className="card-title">Documents</h2>
      <p className="text-text-primary mt-2" style={{ fontWeight: 600, fontSize: '15px' }}>
        {data.completedDocumentsCount} documents submitted
      </p>

      <ul className="mt-3 flex flex-col gap-1.5">
        {data.documents.filter((d) => d.isMandatory).map((doc) => (
          <li key={doc.id} className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#22C55E' }} />
            <span className="text-text-secondary truncate" style={{ fontSize: '13px' }}>{doc.name}</span>
          </li>
        ))}
      </ul>

      {data.applicationId && (
        <div className="mt-3">
          <Link
            href={`/applications/${data.applicationId}/documents`}
            className="text-accent-600"
            style={{ fontSize: '13px', fontWeight: 600 }}
          >
            View all →
          </Link>
        </div>
      )}
    </>
  );
}

/** Compact white card showing document status and upload chips. */
export function DocumentsCard({ data }: DocumentsCardProps) {
  return (
    <div className="card">
      {data.state === 'onboarding_incomplete' && (
        <LockedVariant reason="Unlocks after onboarding" />
      )}
      {data.state === 'pathway_not_selected' && (
        <LockedVariant reason="Unlocks after selecting a pathway" />
      )}
      {data.state === 'application_in_progress' && (
        <ApplicationInProgressVariant data={data} />
      )}
      {data.state === 'application_submitted' && (
        <ApplicationSubmittedVariant data={data} />
      )}
    </div>
  );
}
