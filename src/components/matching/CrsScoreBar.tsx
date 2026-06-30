// Visual CRS score indicator: filled bar for user score, vertical marker for cutoff.

interface Props {
  score: number;
  cutoff: number | null;
}

// Visual ceiling — scores above this fill the bar completely.
const BAR_MAX = 650;

/** Horizontal bar showing the user's CRS score relative to the latest draw cutoff. */
export function CrsScoreBar({ score, cutoff }: Props) {
  const scorePct = Math.min(100, Math.round((score / BAR_MAX) * 100));
  const cutoffPct = cutoff ? Math.min(100, Math.round((cutoff / BAR_MAX) * 100)) : null;

  return (
    <div>
      {/* Bar */}
      <div
        className="relative h-3 bg-bg-muted rounded-full overflow-visible"
        role="img"
        aria-label={`CRS score ${score}${cutoff ? `, cutoff ${cutoff}` : ''}`}
      >
        {/* Score fill */}
        <div
          className="absolute left-0 top-0 h-full bg-accent-500 rounded-full transition-all duration-500"
          style={{ width: `${scorePct}%` }}
        />
        {/* Cutoff marker — rendered outside overflow:hidden so it can peek above */}
        {cutoffPct !== null && (
          <div
            className="absolute top-1/2 -translate-y-1/2 w-0.5 rounded-full"
            style={{
              left:       `${cutoffPct}%`,
              height:     '20px',
              background: 'var(--color-text-secondary)',
              opacity:    0.5,
            }}
          />
        )}
      </div>

      {/* Labels */}
      <div className="flex items-center justify-between mt-1.5">
        <span className="text-text-secondary font-semibold" style={{ fontSize: '12px' }}>
          Your score: {score}
        </span>
        {cutoff !== null ? (
          <span className="text-text-tertiary" style={{ fontSize: '11px' }}>
            Latest cutoff: {cutoff}
          </span>
        ) : (
          <span className="text-text-disabled" style={{ fontSize: '11px' }}>
            Cutoff data loading
          </span>
        )}
      </div>
    </div>
  );
}
