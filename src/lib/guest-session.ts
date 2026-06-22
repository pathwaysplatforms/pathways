"use client";

import { useState, useEffect, useCallback } from "react";

/** localStorage key for the guest session token. */
export const GUEST_TOKEN_KEY = "pathways_guest_token";

/** Read the guest token from localStorage (client-only). Returns null on server. */
export function getGuestToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(GUEST_TOKEN_KEY);
}

/** Persist a guest token to localStorage (client-only). */
export function setGuestToken(token: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(GUEST_TOKEN_KEY, token);
  }
}

/** Remove the guest token from localStorage (client-only). */
export function clearGuestToken(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(GUEST_TOKEN_KEY);
  }
}

/**
 * React hook that initialises or retrieves the guest session token.
 * Calls POST /api/guest/session the first time and persists the returned token.
 */
export function useGuestSession(): {
  token: string | null;
  loading: boolean;
  error: string | null;
} {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const init = useCallback(async () => {
    const existing = getGuestToken();
    if (existing) {
      setToken(existing);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/guest/session", { method: "POST" });
      if (!res.ok) throw new Error("Failed to create guest session");
      const data = (await res.json()) as { session_token: string };
      setGuestToken(data.session_token);
      setToken(data.session_token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start session");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void init();
  }, [init]);

  return { token, loading, error };
}

/**
 * Persists onboarding field deltas for a guest session via the API.
 * Call this after each form step to keep the server in sync.
 */
export async function saveOnboardingProgress(
  token: string,
  delta: Record<string, unknown>
): Promise<void> {
  const res = await fetch(`/api/guest/${token}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ onboarding_data: delta }),
  });
  if (!res.ok) throw new Error("Failed to save onboarding progress");
}

/**
 * Triggers AI pathway matching for a guest session and returns results.
 * Stores results in the session on the server side.
 */
export async function savePathwayResults(
  token: string
): Promise<Record<string, unknown>> {
  const res = await fetch("/api/guest/match", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_token: token }),
  });
  if (!res.ok) throw new Error("Failed to match pathways");
  return res.json() as Promise<Record<string, unknown>>;
}
