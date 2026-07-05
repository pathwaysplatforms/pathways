'use client';

import Link from 'next/link';
import { MessageCircle, ArrowRight } from 'lucide-react';

/**
 * Persistent Ask Pathways entry point, rendered in every dashboard state.
 * Styled as an input bar but navigates to the Ask page (the conversation
 * itself lives there); no text is captured here.
 */
export function AskPathwaysBar() {
  return (
    <Link
      href="/dashboard/ask"
      aria-label="Ask Pathways a question"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        width: '100%',
        padding: '13px 18px',
        borderRadius: 12,
        border: '1px solid rgba(26, 86, 219, 0.18)',
        background: 'rgba(26, 86, 219, 0.04)',
        textDecoration: 'none',
        transition: 'background 120ms ease, border-color 120ms ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(26, 86, 219, 0.08)';
        e.currentTarget.style.borderColor = 'rgba(26, 86, 219, 0.30)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'rgba(26, 86, 219, 0.04)';
        e.currentTarget.style.borderColor = 'rgba(26, 86, 219, 0.18)';
      }}
    >
      <MessageCircle size={16} color="var(--pw-accent)" aria-hidden="true" />
      <span
        style={{
          flex: 1,
          fontFamily: 'var(--pw-font-body)',
          fontSize: 14,
          color: 'var(--pw-muted)',
        }}
      >
        Ask Pathways anything about your immigration journey…
      </span>
      <ArrowRight size={16} color="var(--pw-accent)" aria-hidden="true" />
    </Link>
  );
}
