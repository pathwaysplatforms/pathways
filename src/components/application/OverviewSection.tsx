import Link from 'next/link';

interface OverviewSectionProps {
  pathwayTitle: string;
  pathwayOfficialName: string | null;
  pathwayDescription: string | null;
  processingTime: string;
  feesDisplay: string | null;
  totalSteps: number;
}

interface StatCellProps {
  label: string;
  value: string;
}

/** Single stat cell in the 3-column overview row. */
function StatCell({ label, value }: StatCellProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
      <p
        style={{
          fontFamily: 'var(--pw-font-body)',
          fontSize: 11,
          fontWeight: 500,
          letterSpacing: '0.08em',
          textTransform: 'uppercase' as const,
          color: '#9CA3AF',
          margin: 0,
        }}
      >
        {label}
      </p>
      <p
        style={{
          fontFamily: 'var(--pw-font-body)',
          fontSize: 16,
          fontWeight: 500,
          color: '#0A0A0A',
          margin: 0,
          lineHeight: 1.2,
        }}
      >
        {value}
      </p>
    </div>
  );
}

/** Pathway overview card — System B design with CSS animate-in. */
export function OverviewSection({
  pathwayTitle,
  pathwayOfficialName,
  pathwayDescription,
  processingTime,
  feesDisplay,
  totalSteps,
}: OverviewSectionProps) {
  return (
    <div
      className="pw-entry"
      style={{
        background: '#FFFFFF',
        border: '1px solid #E5E5E5',
        borderRadius: 12,
        padding: 28,
        marginBottom: 16,
      }}
    >
      {/* Eyebrow */}
      <p className="pw-eyebrow" style={{ marginBottom: 6 }}>
        Your Pathway
      </p>

      {/* Pathway title */}
      <h1
        style={{
          fontFamily: 'var(--pw-font-display)',
          fontSize: 28,
          fontWeight: 400,
          color: '#0A0A0A',
          margin: 0,
          lineHeight: 1.15,
        }}
      >
        {pathwayTitle}
      </h1>

      {/* Official name */}
      {pathwayOfficialName && (
        <p
          style={{
            fontFamily: 'var(--pw-font-body)',
            fontSize: 14,
            color: '#6B7280',
            marginTop: 6,
            marginBottom: 0,
          }}
        >
          {pathwayOfficialName}
        </p>
      )}

      {/* Hairline divider */}
      <div
        style={{
          borderTop: '1px solid #E5E5E5',
          margin: '20px 0',
        }}
        aria-hidden="true"
      />

      {/* 3-column stat row */}
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' as const }}>
        <StatCell label="Processing Time" value={processingTime} />
        {feesDisplay && <StatCell label="Estimated Fees" value={feesDisplay} />}
        <StatCell label="Total Steps" value={`${totalSteps} step${totalSteps !== 1 ? 's' : ''}`} />
      </div>

      {/* Description */}
      {pathwayDescription && (
        <p
          style={{
            fontFamily: 'var(--pw-font-body)',
            fontSize: 14,
            color: '#374151',
            marginTop: 20,
            marginBottom: 0,
            lineHeight: 1.65,
          }}
        >
          {pathwayDescription}
        </p>
      )}

      {/* Change pathway link */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
        <Link
          href="/onboarding/matches"
          style={{
            fontFamily: 'var(--pw-font-body)',
            fontSize: 12,
            color: '#1A56DB',
            textDecoration: 'none',
          }}
        >
          Change pathway →
        </Link>
      </div>
    </div>
  );
}
