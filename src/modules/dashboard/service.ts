"use server";

import { createRequestLogger } from "@/lib/logger";
import type { DashboardData, DashboardUserProfile, DrawData } from "./types";

const MOCK_PROFILE: DashboardUserProfile = {
  id: "mock-001",
  name: "Aarav Mehta",
  origin_country: "India",
  destination_country: "Canada",
  pathway: "express_entry_fswp",
  crs_score: 482,
  crs_history: [
    { month: "Feb", score: 471 },
    { month: "Mar", score: 475 },
    { month: "Apr", score: 479 },
    { month: "May", score: 482 },
  ],
  current_step: 2,
  documents_ready: 7,
  documents_total: 12,
  document_names: [
    "Passport",
    "Language scores",
    "ECA",
    "Employment letter",
    "Pay stubs",
    "Tax returns",
    "Photos",
  ],
};

const MOCK_DRAW: DrawData = {
  next_draw_date: "2026-06-03",
  estimated_minimum_crs: 485,
  history: [
    { date: "May 7", crs: 491, type: "All-program" },
    { date: "Apr 23", crs: 486, type: "All-program" },
    { date: "Apr 9", crs: 489, type: "CEC only" },
  ],
};

/**
 * Returns dashboard data for the current user.
 * Swap MOCK_PROFILE / MOCK_DRAW for Supabase queries once CRS fields are in the schema.
 */
export async function getDashboardData(correlationId: string): Promise<DashboardData> {
  const log = createRequestLogger(correlationId);
  log.info({ action: "dashboard.getData.start" });

  const data: DashboardData = {
    profile: MOCK_PROFILE,
    draw: MOCK_DRAW,
  };

  log.info({ action: "dashboard.getData.end" });
  return data;
}
