/** Returns estimated reading time in minutes (200 wpm average). */
export function readingTime(body: string | null): number {
  if (!body) return 0;
  const words = body.trim().split(/\s+/).length;
  return Math.ceil(words / 200);
}
