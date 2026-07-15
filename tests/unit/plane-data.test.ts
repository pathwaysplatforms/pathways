import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchPlaneData,
  getPlaneData,
  setPlaneData,
  prefetchPlaneData,
  clearPlaneData,
} from '@/lib/plane-data';

function okResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function errorResponse(status: number): Response {
  return new Response('{}', { status });
}

describe('plane-data', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    clearPlaneData();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('fetchPlaneData', () => {
    it('fetches, caches, and returns the parsed body (happy path)', async () => {
      fetchMock.mockResolvedValueOnce(okResponse({ data: { value: 1 } }));

      const result = await fetchPlaneData<{ data: { value: number } }>('/api/a');

      expect(result).toEqual({ data: { value: 1 } });
      expect(getPlaneData('/api/a')).toEqual({ data: { value: 1 } });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('deduplicates concurrent requests to the same URL (edge case)', async () => {
      let release: (value: Response) => void = () => {};
      fetchMock.mockReturnValueOnce(new Promise<Response>((resolve) => { release = resolve; }));

      const first = fetchPlaneData<{ n: number }>('/api/a');
      const second = fetchPlaneData<{ n: number }>('/api/a');
      release(okResponse({ n: 7 }));

      await expect(first).resolves.toEqual({ n: 7 });
      await expect(second).resolves.toEqual({ n: 7 });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('throws on a non-OK response and leaves the cache cold (error case)', async () => {
      fetchMock.mockResolvedValueOnce(errorResponse(500));

      await expect(fetchPlaneData('/api/a')).rejects.toThrow('/api/a (500)');
      expect(getPlaneData('/api/a')).toBeUndefined();
    });

    it('allows a retry after a failed request instead of caching the rejection (error case)', async () => {
      fetchMock.mockResolvedValueOnce(errorResponse(500));
      fetchMock.mockResolvedValueOnce(okResponse({ ok: true }));

      await expect(fetchPlaneData('/api/a')).rejects.toThrow();
      await expect(fetchPlaneData<{ ok: boolean }>('/api/a')).resolves.toEqual({ ok: true });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });

  describe('getPlaneData / setPlaneData', () => {
    it('returns undefined for a cold cache (edge case)', () => {
      expect(getPlaneData('/api/never-fetched')).toBeUndefined();
    });

    it('returns what setPlaneData stored (happy path)', () => {
      setPlaneData('/api/a', { data: 'fresh' });
      expect(getPlaneData('/api/a')).toEqual({ data: 'fresh' });
    });

    it('overwrites a previously fetched entry (edge case)', async () => {
      fetchMock.mockResolvedValueOnce(okResponse({ data: 'stale' }));
      await fetchPlaneData('/api/a');

      setPlaneData('/api/a', { data: 'fresh' });
      expect(getPlaneData('/api/a')).toEqual({ data: 'fresh' });
    });
  });

  describe('prefetchPlaneData', () => {
    it('warms every uncached URL (happy path)', async () => {
      // A fresh Response per call — a body can only be consumed once.
      fetchMock.mockImplementation(() => Promise.resolve(okResponse({ warm: true })));

      prefetchPlaneData(['/api/a', '/api/b']);
      await vi.waitFor(() => {
        expect(getPlaneData('/api/a')).toEqual({ warm: true });
        expect(getPlaneData('/api/b')).toEqual({ warm: true });
      });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('skips URLs that are already cached or in flight (edge case)', async () => {
      fetchMock.mockImplementation(() => Promise.resolve(okResponse({ warm: true })));
      setPlaneData('/api/a', { warm: false });
      const inflight = fetchPlaneData('/api/b');

      prefetchPlaneData(['/api/a', '/api/b', '/api/c']);
      await inflight;
      await vi.waitFor(() => expect(getPlaneData('/api/c')).toEqual({ warm: true }));

      // Only /api/b (started above) and /api/c hit the network.
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(getPlaneData('/api/a')).toEqual({ warm: false });
    });

    it('swallows failures silently (error case)', async () => {
      fetchMock.mockRejectedValue(new Error('network down'));

      expect(() => prefetchPlaneData(['/api/a'])).not.toThrow();
      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
      expect(getPlaneData('/api/a')).toBeUndefined();
    });
  });

  describe('clearPlaneData', () => {
    it('empties the cache (happy path)', () => {
      setPlaneData('/api/a', { data: 1 });
      clearPlaneData();
      expect(getPlaneData('/api/a')).toBeUndefined();
    });

    it('is safe to call on an already-empty cache (edge case)', () => {
      expect(() => clearPlaneData()).not.toThrow();
    });

    it('allows re-fetching after a clear (edge case)', async () => {
      fetchMock.mockImplementation(() => Promise.resolve(okResponse({ n: 1 })));
      await fetchPlaneData('/api/a');
      clearPlaneData();

      await fetchPlaneData('/api/a');
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(getPlaneData('/api/a')).toEqual({ n: 1 });
    });
  });
});
