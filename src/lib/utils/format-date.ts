/** Formats an ISO date string as "Month Day, Year" (e.g. "June 14, 2026"). */
export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
