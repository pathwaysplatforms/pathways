import Link from 'next/link';
import { AskPageClient } from '@/components/ask/AskPageClient';

/** Server component: renders the Ask Pathways Q&A page. */
export default async function AskPage() {
  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '20px 28px 4px', flexShrink: 0 }}>
        <Link
          href="/dashboard"
          className="text-pw-muted hover:text-pw-ink transition-colors"
          style={{ fontFamily: 'var(--pw-font-body)', fontSize: '13px', textDecoration: 'none' }}
        >
          ← Back to Dashboard
        </Link>
      </div>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <AskPageClient />
      </div>
    </div>
  );
}
