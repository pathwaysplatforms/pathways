/** Module-scoped registry of checklist flush functions. Client-only — never imported server-side. */
const flushFns = new Set<() => void>();

/** Register a flush callback. Returns a cleanup that de-registers it. */
export function registerChecklistFlush(fn: () => void): () => void {
  flushFns.add(fn);
  return () => flushFns.delete(fn);
}

/** Execute all registered flush callbacks immediately, without waiting for debounce timers. */
export function flushAllChecklists(): void {
  flushFns.forEach(fn => fn());
}
