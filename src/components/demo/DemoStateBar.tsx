"use client";

import { useState } from "react";
import type { DashboardState } from "@/modules/dashboard/types";

const STATES: { n: number; label: string; dashboardState: DashboardState }[] = [
  { n: 1, label: "Onboarding",  dashboardState: "onboarding_incomplete" },
  { n: 2, label: "No Pathway",  dashboardState: "pathway_not_selected" },
  { n: 3, label: "In Progress", dashboardState: "application_in_progress" },
  { n: 4, label: "Submitted",   dashboardState: "application_submitted" },
];

interface DemoStateBarProps {
  currentState: DashboardState;
}

/** Floating pill for switching dashboard states during demos. Only rendered when NEXT_PUBLIC_DEMO_ENABLED=true. */
export function DemoStateBar({ currentState }: DemoStateBarProps) {
  const [pending, setPending] = useState<number | null>(null);

  function switchState(n: number) {
    setPending(n);
    // Hard-navigate to the set-state route; it DB-updates then redirects back to /dashboard
    window.location.href = `/api/demo/set-state?state=${n}`;
  }

  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 bg-text-primary rounded-pill shadow-card-lg px-3 py-1.5">
      <span className="text-xs font-medium text-white/40 pr-2 border-r border-white/20 select-none">
        demo
      </span>
      {STATES.map(({ n, label, dashboardState }) => (
        <button
          key={n}
          onClick={() => switchState(n)}
          disabled={pending !== null}
          className={[
            "px-3 py-1 rounded-pill text-xs font-medium transition-colors disabled:opacity-60",
            currentState === dashboardState
              ? "bg-accent-500 text-white"
              : "text-white/70 hover:text-white hover:bg-white/10",
          ].join(" ")}
        >
          {pending === n ? "…" : label}
        </button>
      ))}
    </div>
  );
}
