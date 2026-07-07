/**
 * Module-scoped stale-while-revalidate cache for plane view data.
 * Client-only — never imported server-side.
 *
 * The cache is heterogeneous (one entry per endpoint URL), so reads cast the
 * stored `unknown` to the caller's type: each call site binds exactly one
 * response type to one URL, which makes the cast safe by construction.
 */

const cache = new Map<string, unknown>();
const inflight = new Map<string, Promise<unknown>>();

/** Returns the cached response for a URL, or undefined when the cache is cold. */
export function getPlaneData<T>(url: string): T | undefined {
  // Safe cast: see module comment — one response type per URL.
  return cache.get(url) as T | undefined;
}

/** Overwrites the cached response for a URL (e.g. after a mutation returned fresh data). */
export function setPlaneData<T>(url: string, data: T): void {
  cache.set(url, data);
}

/** Fetches a plane endpoint, deduplicating concurrent requests and caching the parsed body. */
export function fetchPlaneData<T>(url: string): Promise<T> {
  const existing = inflight.get(url);
  // Safe cast: see module comment — one response type per URL.
  if (existing) return existing as Promise<T>;

  const request = (async () => {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Plane data request failed: ${url} (${res.status})`);
      const json = (await res.json()) as unknown;
      cache.set(url, json);
      return json;
    } finally {
      inflight.delete(url);
    }
  })();

  inflight.set(url, request);
  // Safe cast: see module comment — one response type per URL.
  return request as Promise<T>;
}

/** Fire-and-forget warm-up of endpoints that are neither cached nor already in flight. */
export function prefetchPlaneData(urls: readonly string[]): void {
  for (const url of urls) {
    if (cache.has(url) || inflight.has(url)) continue;
    void fetchPlaneData(url).catch(() => {
      // Prefetch is opportunistic — the owning view surfaces real errors on activation.
    });
  }
}

/** Drops all cached plane data. Must be called on sign-out so no data leaks across accounts. */
export function clearPlaneData(): void {
  cache.clear();
}
