'use client';

import { Clock } from 'lucide-react';
import { useDashboardData } from '@/contexts/DashboardDataContext';

/** Truncates text to maxLen characters, appending "…" if needed. */
function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen).trimEnd() + '…';
}

/** Maps a nationality string to a flag emoji heuristic. */
function nationalityFlag(nationality: string | null): string {
  if (!nationality) return '🌍';
  const n = nationality.toLowerCase();
  if (n.includes('indian') || n.includes('india')) return '🇮🇳';
  if (n.includes('chinese') || n.includes('china')) return '🇨🇳';
  if (n.includes('nigerian') || n.includes('nigeria')) return '🇳🇬';
  if (n.includes('philippine') || n.includes('filipino')) return '🇵🇭';
  if (n.includes('mexican') || n.includes('mexico')) return '🇲🇽';
  if (n.includes('brazilian') || n.includes('brazil')) return '🇧🇷';
  if (n.includes('british') || n.includes('uk') || n.includes('united kingdom')) return '🇬🇧';
  if (n.includes('american') || n.includes('usa') || n.includes('united states')) return '🇺🇸';
  if (n.includes('french') || n.includes('france')) return '🇫🇷';
  if (n.includes('german') || n.includes('germany')) return '🇩🇪';
  return '🌍';
}

function DataPendingCard() {
  return (
    <div
      className="flex-1 min-h-0 rounded-xl flex flex-col items-center justify-center gap-3"
      style={{
        border: '1px solid rgba(0,0,0,0.10)',
        background: '#FAFAFA',
        minHeight: 90,
      }}
    >
      <Clock size={20} style={{ color: 'var(--pw-muted)' }} aria-hidden="true" />
      <p
        style={{
          fontFamily: 'var(--pw-font-body)',
          fontSize: '12px',
          color: 'var(--pw-muted)',
          textAlign: 'center',
        }}
      >
        Pathway data loading…
      </p>
    </div>
  );
}

/**
 * Pathway Intelligence card: replaces the decorative map card with real pathway
 * and profile data sourced from DashboardDataContext.
 */
export function MapCard() {
  const data = useDashboardData();

  const pathwayTitle =
    data?.selectedPathwayTitle ?? data?.pathwayTitle ?? null;
  const description = data?.selectedPathwayDescription ?? null;
  const nationality =
    data?.profileContext.nationality ?? data?.nationalityVoice ?? null;

  if (!data || !pathwayTitle) {
    return <DataPendingCard />;
  }

  const descriptionText = description
    ? truncate(description, 120)
    : null;

  return (
    <div
      className="flex-1 min-h-0 rounded-xl flex flex-col min-h-0 overflow-hidden"
      style={{
        border: '1px solid rgba(0,0,0,0.08)',
        background: '#FFFFFF',
        padding: '22px',
        minHeight: 90,
      }}
    >
      {/* Eyebrow */}
      <p
        style={{
          fontFamily: 'var(--pw-font-body)',
          fontSize: '10px',
          fontWeight: 500,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'var(--pw-muted)',
          flexShrink: 0,
          marginBottom: 8,
        }}
      >
        Pathway Intelligence
      </p>

      {/* Pathway name */}
      <p
        style={{
          fontFamily: 'var(--pw-font-display)',
          fontSize: '18px',
          fontWeight: 400,
          color: 'var(--pw-ink)',
          lineHeight: 1.2,
          flexShrink: 0,
        }}
      >
        {pathwayTitle}
      </p>

      {/* Description */}
      {descriptionText && (
        <p
          style={{
            fontFamily: 'var(--pw-font-body)',
            fontSize: '11px',
            color: 'var(--pw-muted)',
            marginTop: 6,
            lineHeight: 1.5,
            flex: 1,
            overflow: 'hidden',
          }}
        >
          {descriptionText}
        </p>
      )}
      {!descriptionText && <div style={{ flex: 1 }} />}

      {/* Profile pill badges */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 6,
          marginTop: 10,
          flexShrink: 0,
        }}
      >
        {nationality && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '3px 10px',
              borderRadius: 9999,
              border: '1px solid rgba(0,0,0,0.10)',
              fontFamily: 'var(--pw-font-body)',
              fontSize: '11px',
              color: 'var(--pw-ink)',
              background: '#F7F7F5',
            }}
          >
            {nationalityFlag(nationality)} {nationality} national
          </span>
        )}
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '3px 10px',
            borderRadius: 9999,
            border: '1px solid rgba(0,0,0,0.10)',
            fontFamily: 'var(--pw-font-body)',
            fontSize: '11px',
            color: 'var(--pw-ink)',
            background: '#F7F7F5',
          }}
        >
          🇨🇦 Canada
        </span>
        {!nationality && (
          <a
            href="/dashboard/profile"
            style={{
              fontFamily: 'var(--pw-font-body)',
              fontSize: '11px',
              color: 'var(--pw-accent)',
              textDecoration: 'none',
              alignSelf: 'center',
            }}
            aria-label="Complete your profile to add nationality"
          >
            + Complete your profile
          </a>
        )}
      </div>

      {/* Official requirements link — field does not exist in pathways schema yet */}
      {/* FLAG: pathways.official_url does not exist; link omitted until schema is extended */}
    </div>
  );
}
