/** Dashboard-specific user profile with CRS score and document tracking data. */
export type DashboardUserProfile = {
  id: string;
  name: string;
  origin_country: string;
  destination_country: string;
  pathway: "express_entry_fswp" | "oinp_tech" | "family_sponsorship";
  crs_score: number;
  crs_history: { month: string; score: number }[];
  current_step: 1 | 2 | 3 | 4 | 5;
  documents_ready: number;
  documents_total: number;
  document_names: string[];
};

/** Express Entry draw history and next draw projection. */
export type DrawData = {
  next_draw_date: string;
  estimated_minimum_crs: number;
  history: { date: string; crs: number; type: string }[];
};

/** Combined payload returned by getDashboardData. */
export type DashboardData = {
  profile: DashboardUserProfile;
  draw: DrawData;
};
