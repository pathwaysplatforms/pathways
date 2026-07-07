'use client';

/** Centered loading spinner shown while a plane view fetches its data. */
export function PlaneSpinner() {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div
        style={{
          width: 28, height: 28, borderRadius: '50%',
          border: '2px solid rgba(0,0,0,0.08)',
          borderTopColor: 'var(--pw-ink)',
          animation: 'spin 0.7s linear infinite',
        }}
      />
    </div>
  );
}

interface PlaneErrorProps {
  /** Body copy under the "Something went wrong" heading. */
  message: string;
  onRetry: () => void;
}

/** Centered error card with a retry button, shown when a plane view fails to load. */
export function PlaneError({ message, onRetry }: PlaneErrorProps) {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 28 }}>
      <div style={{ maxWidth: 400, textAlign: 'center', padding: '32px 28px', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 12 }}>
        <p style={{ fontFamily: 'var(--pw-font-display)', fontSize: '1.5rem', color: '#0D0D0D', marginBottom: 8 }}>
          Something went wrong
        </p>
        <p style={{ fontFamily: 'var(--pw-font-body)', fontSize: 14, color: '#6B6B6B', marginBottom: 20 }}>
          {message}
        </p>
        <button
          type="button"
          onClick={onRetry}
          style={{
            display: 'inline-flex', alignItems: 'center', padding: '9px 20px',
            fontFamily: 'var(--pw-font-body)', fontSize: 14, fontWeight: 500,
            color: '#fff', background: '#0D0D0D', borderRadius: 9999, border: 'none', cursor: 'pointer',
          }}
        >
          Retry
        </button>
      </div>
    </div>
  );
}
