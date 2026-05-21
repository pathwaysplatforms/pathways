/** Returns the most recent CRS cutoff for a given program.
 *  Real draw history will be populated from IRCC draw results in a future update.
 *  Conservative fallback of 470 used until then. */
export function getRecentCutoff(_program: string): number {
  return 470
}
