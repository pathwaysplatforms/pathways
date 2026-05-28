'use client';

/** Loading skeleton matching the new 2-column bento dashboard layout. */
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
          <div className="h-2.5 w-24 bg-bg-muted rounded animate-pulse" />
          <div className="h-6 w-52 bg-bg-muted rounded animate-pulse" />
        </div>

        {/* Card row skeleton */}
        <div
          className="grid grid-cols-2 flex-shrink-0"
          style={{ gap: 14, height: 155 }}
        >
          <div className="rounded-card bg-bg-muted animate-pulse h-full" />
          <div className="rounded-card bg-bg-muted animate-pulse h-full" />
        </div>

        {/* Map card skeleton */}
        <div className="rounded-card bg-bg-muted animate-pulse flex-1 min-h-0" />
      </div>

      {/* Right column skeleton */}
      <div className="flex-shrink-0 rounded-card bg-bg-muted animate-pulse" style={{ width: 220 }} />
    </div>
  );
}
