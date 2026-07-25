'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { MissionAction } from '@/modules/dashboard/mission-control';

const CARD: React.CSSProperties = {
  background: '#FFFFFF',
  borderRadius: 16,
  padding: '24px',
  // Fills the flex wrapper in the executing row so the two cards keep equal
  // heights; inert when the parent lays out as a block.
  width: '100%',
};

function DeltaChip({ label }: { label: string }) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: 9999,
        background: 'rgba(26, 86, 219, 0.08)',
        color: 'var(--pw-accent)',
        fontFamily: 'var(--pw-font-ui)',
        fontSize: 11,
        fontWeight: 500,
      }}
    >
      {label}
    </span>
  );
}

/**
 * The single surfaced next best action plus an expandable "see all" queue.
 * Renders nothing when the queue is empty (null discipline).
 */
export function NextBestActionCard({ actions }: { actions: MissionAction[] }) {
  const [expanded, setExpanded] = useState(false);
  const top = actions[0];
  if (top === undefined) return null;

  const rest = actions.slice(1);

  return (
    <section style={CARD} aria-label="Next best action">
      <p className="pw-eyebrow" style={{ marginBottom: 10 }}>Next best action</p>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
        <h2
          style={{
            fontFamily: 'var(--pw-font-display)',
            fontSize: 20,
            fontWeight: 400,
            color: 'var(--pw-ink)',
            lineHeight: 1.25,
            margin: 0,
          }}
        >
          {top.label}
        </h2>
        {top.deltaLabel !== null && <DeltaChip label={top.deltaLabel} />}
      </div>

      <p
        style={{
          fontFamily: 'var(--pw-font-body)',
          fontSize: 14,
          color: 'var(--pw-muted)',
          lineHeight: 1.6,
          margin: '0 0 16px',
        }}
      >
        {top.description}
      </p>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        {top.href !== null && (
          <Link
            href={top.href}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '8px 18px',
              borderRadius: 9999,
              background: 'var(--pw-ink)',
              color: '#FFFFFF',
              fontFamily: 'var(--pw-font-ui)',
              fontSize: 13,
              fontWeight: 500,
              textDecoration: 'none',
            }}
          >
            Go →
          </Link>
        )}
        {rest.length > 0 && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              fontFamily: 'var(--pw-font-body)',
              fontSize: 13,
              color: 'var(--pw-accent)',
            }}
          >
            {expanded ? 'Show less' : `See all ${actions.length} tasks`}
            {expanded
              ? <ChevronUp size={14} aria-hidden="true" />
              : <ChevronDown size={14} aria-hidden="true" />}
          </button>
        )}
      </div>

      {expanded && rest.length > 0 && (
        <ul style={{ listStyle: 'none', margin: '16px 0 0', padding: 0 }}>
          {rest.map((action) => (
            <li
              key={action.id}
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 8,
                padding: '10px 0',
                borderTop: '1px solid rgba(0,0,0,0.06)',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <p
                    style={{
                      fontFamily: 'var(--pw-font-body)',
                      fontSize: 13,
                      fontWeight: 500,
                      color: 'var(--pw-ink)',
                      margin: 0,
                    }}
                  >
                    {action.label}
                  </p>
                  {action.deltaLabel !== null && <DeltaChip label={action.deltaLabel} />}
                </div>
                <p
                  style={{
                    fontFamily: 'var(--pw-font-body)',
                    fontSize: 12,
                    color: 'var(--pw-muted)',
                    lineHeight: 1.5,
                    margin: '2px 0 0',
                  }}
                >
                  {action.description}
                </p>
              </div>
              {action.href !== null && (
                <Link
                  href={action.href}
                  style={{
                    fontFamily: 'var(--pw-font-body)',
                    fontSize: 12,
                    color: 'var(--pw-accent)',
                    textDecoration: 'none',
                    flexShrink: 0,
                  }}
                >
                  Open →
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
