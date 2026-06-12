import { SwissPageShell } from '@/components/layout/SwissPageShell';

type DocStatus = 'complete' | 'pending' | 'not_started';

interface DocumentItem {
  name: string;
  status: DocStatus;
}

// Hardcoded Express Entry FSW checklist — replace with DB-driven data in a future sprint
const DOCUMENTS: DocumentItem[] = [
  { name: 'Valid passport', status: 'complete' },
  { name: 'Language test results (IELTS / CELPIP)', status: 'complete' },
  { name: 'Educational credential assessment (WES)', status: 'complete' },
  { name: 'Police clearance certificate', status: 'pending' },
  { name: 'Medical examination', status: 'pending' },
  { name: 'Proof of work experience (reference letters)', status: 'pending' },
  { name: 'Proof of funds', status: 'pending' },
  { name: 'Provincial nomination certificate (if applicable)', status: 'not_started' },
];

function StatusChip({ status }: { status: DocStatus }) {
  if (status === 'complete') {
    return (
      <span
        className="inline-flex items-center gap-2"
        style={{ fontFamily: 'var(--pw-font-body)', fontSize: '12px', color: 'var(--pw-ink)' }}
      >
        <span
          className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: 'var(--pw-ink)' }}
          aria-hidden="true"
        >
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
            <path d="M1.5 4l2 2 3-3" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        Complete
      </span>
    );
  }
  if (status === 'pending') {
    return (
      <span
        className="inline-flex items-center gap-2"
        style={{ fontFamily: 'var(--pw-font-body)', fontSize: '12px', color: 'var(--pw-muted)' }}
      >
        <span
          className="w-4 h-4 rounded-full border flex-shrink-0"
          style={{ borderColor: 'var(--pw-muted)' }}
          aria-hidden="true"
        />
        Pending
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-2"
      style={{ fontFamily: 'var(--pw-font-body)', fontSize: '12px', color: 'var(--pw-muted)' }}
    >
      <span aria-hidden="true">–</span>
      Not started
    </span>
  );
}

/** Document checklist page — Express Entry FSW. */
export default function DocumentsPage() {
  const total = DOCUMENTS.length;
  const complete = DOCUMENTS.filter((d) => d.status === 'complete').length;
  const pending = DOCUMENTS.filter((d) => d.status !== 'complete').length;

  return (
    <SwissPageShell>
      <main className="max-w-6xl mx-auto px-6 py-20">
        {/* ── Header ── */}
        <div className="mb-16">
          <p className="pw-eyebrow pw-entry">DOCUMENTS</p>
          <div className="pw-rule-line mt-3 mb-6 pw-entry pw-entry-delay-1" />
          <h1
            className="pw-entry pw-entry-delay-2 mb-3 leading-tight"
            style={{
              fontFamily: 'var(--pw-font-display)',
              fontWeight: 400,
              fontSize: 'clamp(2rem, 5vw, 3.5rem)',
              color: 'var(--pw-ink)',
            }}
          >
            Document checklist
          </h1>
          <p
            className="pw-entry pw-entry-delay-3 text-sm"
            style={{ fontFamily: 'var(--pw-font-body)', color: 'var(--pw-muted)' }}
          >
            Track every document required for your Express Entry application.
          </p>
        </div>

        {/* ── Progress strip ── */}
        <div className="pw-entry pw-entry-delay-4 flex items-center gap-0 mb-16">
          {(
            [
              { label: 'TOTAL', value: total },
              { label: 'COMPLETE', value: complete },
              { label: 'PENDING', value: pending },
            ] as const
          ).map(({ label, value }, i) => (
            <div key={label} className="flex items-center flex-1">
              <div>
                <p
                  className="pw-eyebrow mb-1"
                  style={{ fontSize: '10px' }}
                >
                  {label}
                </p>
                <p
                  style={{
                    fontFamily: 'var(--pw-font-display)',
                    fontSize: '36px',
                    fontWeight: 400,
                    color: 'var(--pw-ink)',
                    lineHeight: 1,
                  }}
                >
                  {value}
                </p>
              </div>
              {i < 2 && (
                <div
                  className="mx-8 self-stretch"
                  style={{ width: '1px', background: 'var(--pw-rule)' }}
                />
              )}
            </div>
          ))}
        </div>

        {/* ── Document list ── */}
        <div className="mb-12">
          <p className="pw-eyebrow pw-entry pw-entry-delay-5">REQUIRED DOCUMENTS</p>
          <div className="pw-rule-line mt-3 mb-8 pw-entry pw-entry-delay-5" />
          <div className="flex flex-col gap-3">
            {DOCUMENTS.map((doc, i) => (
              <div
                key={doc.name}
                className="pw-entry flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                style={{
                  border: '1px solid var(--pw-rule)',
                  borderRadius: '12px',
                  padding: '16px 28px',
                  background: 'var(--pw-bg)',
                  transition: 'border-color 150ms ease',
                  animationDelay: `${330 + i * 40}ms`,
                }}
              >
                <div className="flex items-center gap-4 flex-1">
                  <span
                    className="flex-shrink-0"
                    style={{
                      fontFamily: 'var(--pw-font-body)',
                      fontSize: '10px',
                      fontWeight: 500,
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      color: 'var(--pw-muted)',
                      minWidth: '20px',
                    }}
                  >
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <p
                    style={{
                      fontFamily: 'var(--pw-font-body)',
                      fontSize: '15px',
                      fontWeight: 500,
                      color: 'var(--pw-ink)',
                    }}
                  >
                    {doc.name}
                  </p>
                </div>
                <div className="flex items-center gap-6 flex-shrink-0">
                  <StatusChip status={doc.status} />
                  {doc.status === 'complete' ? (
                    <button
                      className="pw-btn-secondary"
                      style={{ padding: '6px 16px', fontSize: '12px' }}
                    >
                      View
                    </button>
                  ) : (
                    <button
                      className="pw-btn-secondary"
                      style={{ padding: '6px 16px', fontSize: '12px' }}
                    >
                      Upload
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Note ── */}
        <p
          style={{
            fontFamily: 'var(--pw-font-body)',
            fontSize: '12px',
            color: 'var(--pw-muted)',
          }}
        >
          Document requirements vary by pathway and individual circumstances. Always verify with
          official IRCC sources before submission.
        </p>
      </main>
    </SwissPageShell>
  );
}
