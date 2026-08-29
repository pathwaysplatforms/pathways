'use client';

/** Loading skeleton matching the new 2-column bento dashboard layout — hairline-bordered blocks with a slow opacity pulse. */
export function DashboardSkeleton() {
  return (
    <div
      className="flex flex-1 min-h-0 overflow-hidden"
      style={{ gap: 14, padding: '0 28px 28px' }}
    >
      {/* Left column */}
      <div className="flex flex-col flex-1 min-h-0" style={{ gap: 14 }}>
        {/* Greeting skeleton */}
        <div className="flex flex-col gap-2 flex-shrink-0">
          <div className="pw-skeleton h-2.5 w-24 rounded" />
          <div className="pw-skeleton h-6 w-52 rounded" />
        </div>

        {/* Card row skeleton */}
        <div
          className="grid grid-cols-2 flex-shrink-0"
          style={{ gap: 14, height: 155 }}
        >
          <div className="pw-skeleton rounded-card h-full" />
          <div className="pw-skeleton rounded-card h-full" />
        </div>

        {/* Map card skeleton */}
        <div className="pw-skeleton rounded-card flex-1 min-h-0" />
      </div>

      {/* Right column skeleton */}
      <div className="pw-skeleton flex-shrink-0 rounded-card" style={{ width: 220 }} />
    </div>
  );
}
