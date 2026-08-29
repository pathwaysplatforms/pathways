/**
 * Data endpoints backing each plane view. The views read their own entry and the
 * DashboardShell prefetches all of them on mount, so the slide never lands on a
 * cold cache. (PathwayRecommendations also uses the `pathways` URL directly.)
 */
export const PLANE_DATA_URLS = {
  dashboard: '/api/dashboard/data',
  application: '/api/application/data',
  documents: '/api/vault/files',
  pathways: '/api/pathways/match',
  draws: '/api/draws/data',
} as const;
