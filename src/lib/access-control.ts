"use client";

import { useState, useEffect } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export type SubscriptionTier = "guest" | "free" | "paid" | "admin";

/**
 * Route-level access map. Middleware and the useAccess hook consult this.
 * Prefix matching: '/applications' covers '/applications/123/documents' etc.
 */
export const ACCESS_MAP: Record<SubscriptionTier, string[] | "*"> = {
  guest: ["/", "/onboarding", "/results", "/auth", "/api/auth"],
  free: [
    "/",
    "/onboarding",
    "/results",
    "/auth",
    "/api/auth",
    "/dashboard",
    "/pathways",
    "/applications",
    "/account",
  ],
  paid: [
    "/",
    "/onboarding",
    "/results",
    "/auth",
    "/api/auth",
    "/dashboard",
    "/pathways",
    "/applications",
    "/account",
  ],
  admin: "*",
};

/** Returns true when a user with the given tier may access the route. */
export function canAccess(tier: SubscriptionTier, pathname: string): boolean {
  const allowed = ACCESS_MAP[tier];
  if (allowed === "*") return true;
  return allowed.some((prefix) => pathname === prefix || pathname.startsWith(prefix + "/") || pathname.startsWith(prefix + "?"));
}

type UseAccessResult = {
  tier: SubscriptionTier;
  loading: boolean;
  isAdmin: boolean;
  canAccessRoute: (pathname: string) => boolean;
};

/** Client-side hook that reads the current user's subscription tier from the JWT. */
export function useAccess(): UseAccessResult {
  const [tier, setTier] = useState<SubscriptionTier>("guest");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getUser().then(({ data }) => {
      const user = data.user;
      if (!user) {
        setTier("guest");
        setLoading(false);
        return;
      }
      const isAdmin = user.app_metadata?.is_admin === true;
      if (isAdmin) {
        setTier("admin");
        setLoading(false);
        return;
      }
      const status = (user.app_metadata?.subscription_status as string | undefined) ?? "free";
      const validTiers: SubscriptionTier[] = ["guest", "free", "paid"];
      setTier(validTiers.includes(status as SubscriptionTier) ? (status as SubscriptionTier) : "free");
      setLoading(false);
    });
  }, []);

  return {
    tier,
    loading,
    isAdmin: tier === "admin",
    canAccessRoute: (pathname: string) => canAccess(tier, pathname),
  };
}
