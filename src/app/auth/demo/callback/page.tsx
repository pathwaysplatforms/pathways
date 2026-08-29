"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Handles the implicit-flow redirect from admin.generateLink.
 * @supabase/ssr disables detectSessionInUrl, so we parse the hash manually
 * and call setSession to persist the tokens to cookies before navigating.
 */
export default function DemoCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const hash = window.location.hash.slice(1); // strip leading #
    const params = new URLSearchParams(hash);
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");

    console.log("[demo/callback] hash tokens present:", { accessToken: !!accessToken, refreshToken: !!refreshToken });

    if (!accessToken || !refreshToken) {
      console.log("[demo/callback] missing tokens, redirecting to login");
      router.replace("/auth/login?error=auth");
      return;
    }

    const supabase = createSupabaseBrowserClient();
    supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ data, error }) => {
        console.log("[demo/callback] setSession result:", data.session ? `ok, user=${data.session.user.email}` : "no session", error ?? "");
        if (error || !data.session) {
          router.replace("/auth/login?error=auth");
        } else {
          router.replace("/dashboard");
        }
      });
  }, [router]);

  return (
    <main className="min-h-screen bg-bg-base flex items-center justify-center">
      <p className="text-sm text-text-tertiary">Signing you in…</p>
    </main>
  );
}
