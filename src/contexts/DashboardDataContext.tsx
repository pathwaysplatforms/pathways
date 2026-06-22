'use client';

import { createContext, useContext } from 'react';
import type { DashboardData } from '@/modules/dashboard/types';

const DashboardDataContext = createContext<DashboardData | null>(null);

/** Provides DashboardData to all descendant client components. */
export function DashboardDataProvider({
  data,
  children,
}: {
  data: DashboardData;
  children: React.ReactNode;
}) {
  return (
    <DashboardDataContext.Provider value={data}>
      {children}
    </DashboardDataContext.Provider>
  );
}

/** Returns DashboardData from the nearest provider, or null if not mounted. */
export function useDashboardData(): DashboardData | null {
  return useContext(DashboardDataContext);
}
