/**
 * Temporary static mapping of step_number → document name substrings.
 * Used to associate pathway-level document_requirements rows with specific steps
 * until a step_id FK migration is in place.
 */
export const STEP_DOCUMENT_MAP: Record<number, string[]> = {
  1: ['education', 'credential', 'degree', 'diploma', 'transcript', 'ECA'],
  2: ['language', 'IELTS', 'CELPIP', 'CLB', 'TEF', 'TCF'],
  3: ['passport', 'identity', 'photo', 'birth certificate'],
  4: [],
  5: ['police', 'medical', 'IMM', 'sponsor', 'employment', 'reference', 'tax'],
};

/** Returns true when the document name matches any substring for the given step. */
export function documentBelongsToStep(
  documentName: string,
  stepNumber: number
): boolean {
  const substrings = STEP_DOCUMENT_MAP[stepNumber] ?? [];
  if (substrings.length === 0) return false;
  const lower = documentName.toLowerCase();
  return substrings.some((s) => lower.includes(s.toLowerCase()));
}
