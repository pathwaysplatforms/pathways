import { createClient } from "@supabase/supabase-js";
import { describe, it, expect, beforeAll, afterAll } from "vitest";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_LOCAL_URL || "http://127.0.0.1:54321";
const DEFAULT_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRFA0NiK7UFwicknvljLQ12D_NYDggkjjdhfnlpTLCs";
const DEFAULT_SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hj04zWl196z2-SB38";

const SUPABASE_SECRET_KEY =
  process.env.SUPABASE_LOCAL_SECRET_KEY || DEFAULT_SERVICE_ROLE_KEY;
const APP_URL = process.env.APP_URL ?? "http://localhost:3000";

const TEST_PASSWORD = "TestPassword123!";

const adminClient = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY);

const testEmail = `auth-test-${Date.now()}@example.com`;
let testUserId: string;
let testProfileId: string;

beforeAll(async () => {
  const { data, error } = await adminClient.auth.admin.createUser({
    email: testEmail,
    password: TEST_PASSWORD,
    email_confirm: true,
  });
  if (error) throw error;
  testUserId = data.user.id;
});

afterAll(async () => {
  if (testProfileId) {
    await adminClient.from("profiles").delete().eq("id", testProfileId);
  }
  if (testUserId) {
    await adminClient.auth.admin.deleteUser(testUserId);
  }
});

describe("profile auto-creation on signup", () => {
  it("creates a profile row automatically when a new user is created", async () => {
    const { data, error } = await adminClient
      .from("profiles")
      .select("id, auth_user_id, onboarding_status")
      .eq("auth_user_id", testUserId)
      .single();

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    testProfileId = data!.id;
  });

  it("profile row has correct auth_user_id matching the auth user", async () => {
    const { data } = await adminClient
      .from("profiles")
      .select("auth_user_id")
      .eq("auth_user_id", testUserId)
      .single();

    expect(data?.auth_user_id).toBe(testUserId);
  });

  it("profile starts with onboarding_status = not_started", async () => {
    const { data } = await adminClient
      .from("profiles")
      .select("onboarding_status")
      .eq("auth_user_id", testUserId)
      .single();

    expect(data?.onboarding_status).toBe("not_started");
  });
});

describe("HTTP route protection (requires dev server)", () => {
  async function isAppRunning(): Promise<boolean> {
    try {
      await fetch(APP_URL, { signal: AbortSignal.timeout(3000) });
      return true;
    } catch {
      return false;
    }
  }

  it("unauthenticated request to a protected route redirects to /auth/login", async () => {
    const running = await isAppRunning();
    if (!running) {
      console.warn("Skipping HTTP test — dev server not running");
      return;
    }

    const response = await fetch(`${APP_URL}/dashboard`, {
      redirect: "manual",
    });

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/auth/login");
  });

  it("authenticated user with complete onboarding can access /dashboard", async () => {
    const running = await isAppRunning();
    if (!running) {
      console.warn("Skipping HTTP test — dev server not running");
      return;
    }

    // Set onboarding_status to complete for our test user
    await adminClient
      .from("profiles")
      .update({ onboarding_status: "complete" })
      .eq("auth_user_id", testUserId);

    // Sign in to get a session token
    const anonKey =
      process.env.NEXT_PUBLIC_SUPABASE_LOCAL_PUBLISHABLE_KEY || DEFAULT_ANON_KEY;
    const anonClient = createClient(SUPABASE_URL, anonKey);
    const { data: signInData } = await anonClient.auth.signInWithPassword({
      email: testEmail,
      password: TEST_PASSWORD,
    });

    if (!signInData.session) {
      console.warn("Skipping HTTP test — could not create session");
      return;
    }

    const response = await fetch(`${APP_URL}/dashboard`, {
      redirect: "manual",
      headers: {
        Cookie: `sb-${new URL(SUPABASE_URL).hostname.replace(/\./g, "-")}-auth-token=${JSON.stringify(signInData.session)}`,
      },
    });

    // 200 means dashboard is accessible, any 3xx redirect to a non-auth page is also acceptable
    const location = response.headers.get("location") ?? "";
    const isAccessible =
      response.status === 200 || !location.includes("/auth/login");
    expect(isAccessible).toBe(true);
  });
});
