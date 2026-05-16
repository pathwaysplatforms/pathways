"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createRequestLogger } from "@/lib/logger";
import { AuthError, ValidationError } from "@/lib/errors";
import type { Session, User, Profile } from "./types";

const emailSchema = z.string().email();

function getOrigin(): string {
  const h = headers();
  return h.get("origin") ?? "http://localhost:3000";
}

export async function getSession(): Promise<Session | null> {
  const supabase = createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session;
}

export async function getProfile(): Promise<Profile | null> {
  const session = await getSession();
  if (!session) return null;

  const supabase = createSupabaseServerClient();
  // Database types pending regeneration — cast until `supabase gen types --local` is run
  const db = supabase as unknown as SupabaseClient;
  const { data } = await db
    .from("profiles")
    .select("*")
    .eq("auth_user_id", session.user.id)
    .single();

  return (data as Profile) ?? null;
}

export async function requireAuth(): Promise<User> {
  const session = await getSession();

  if (!session) {
    const reqLogger = createRequestLogger(crypto.randomUUID());
    let path = "unknown";
    try {
      path = headers().get("x-pathname") ?? "unknown";
    } catch {
      // headers() unavailable outside request context
    }
    reqLogger.warn({ action: "auth.unauthorized_access", path });
    throw new AuthError();
  }

  return session.user;
}

export async function requireAdmin(): Promise<User> {
  const user = await requireAuth();

  // Use admin client to bypass RLS for reliable is_admin check
  const adminSupabase = createSupabaseAdminClient();
  const db = adminSupabase as unknown as SupabaseClient;
  const { data } = await db
    .from("profiles")
    .select("is_admin")
    .eq("auth_user_id", user.id)
    .single();

  const profile = data as Pick<Profile, "is_admin"> | null;
  if (!profile?.is_admin) {
    throw new AuthError("Forbidden");
  }

  return user;
}

export async function signInWithEmail(email: string): Promise<void> {
  const parsed = emailSchema.safeParse(email);
  if (!parsed.success) {
    throw new ValidationError("Invalid email address");
  }

  const origin = getOrigin();
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });

  if (error) {
    throw new AuthError("Failed to send sign-in link", undefined, error);
  }

  const reqLogger = createRequestLogger(crypto.randomUUID());
  reqLogger.info({ action: "auth.magic_link_requested", email });
}

export async function signInWithGoogle(): Promise<void> {
  const origin = getOrigin();
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin}/auth/callback` },
  });

  if (error || !data.url) {
    throw new AuthError(
      "Failed to initiate Google sign-in",
      undefined,
      error ?? undefined
    );
  }

  const reqLogger = createRequestLogger(crypto.randomUUID());
  reqLogger.info({ action: "auth.google_oauth_initiated" });

  redirect(data.url);
}

export async function signOut(): Promise<void> {
  const session = await getSession();
  const supabase = createSupabaseServerClient();
  const reqLogger = createRequestLogger(crypto.randomUUID());

  await supabase.auth.signOut();

  reqLogger.info({ action: "auth.signed_out", userId: session?.user.id });
  redirect("/auth/login");
}
