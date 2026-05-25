'use client';

/** Loading skeleton matching the 3-column dashboard grid layout. */
export function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-5 p-7 flex-1">
      {/* Top bar skeleton */}
      <div className="flex justify-between items-start">
        <div className="flex flex-col gap-2">
          <div className="h-5 w-48 bg-bg-muted rounded animate-pulse" />
          <div className="h-3 w-32 bg-bg-muted rounded animate-pulse" />
        </div>
        <div className="h-6 w-28 bg-bg-muted rounded-badge animate-pulse" />
      </div>

      {/* 3-column grid skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 flex-1">
        {/* Col 1 */}
        <div className="flex flex-col gap-5">
          <div className="card bg-bg-muted animate-pulse" style={{ minHeight: 180 }} />
          <div className="card bg-bg-muted animate-pulse" style={{ minHeight: 180 }} />
        </div>

        {/* Col 2 */}
        <div className="card bg-bg-muted animate-pulse" style={{ minHeight: 380 }} />

        {/* Col 3 */}
        <div className="flex flex-col gap-5">
          <div className="card bg-bg-muted animate-pulse" style={{ flex: '3' }} />
          <div className="card bg-bg-muted animate-pulse" style={{ flex: '2' }} />
        </div>
      </div>
    </div>
  );
}
