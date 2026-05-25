import { createClient } from "@supabase/supabase-js";
import { describe, it, expect, beforeAll, afterAll } from "vitest";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_LOCAL_URL || "http://127.0.0.1:54321";
const DEFAULT_SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const DEFAULT_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

const SERVICE_KEY = process.env.SUPABASE_LOCAL_SECRET_KEY || DEFAULT_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_LOCAL_PUBLISHABLE_KEY || DEFAULT_ANON_KEY;
const TEST_PASSWORD = "TestPassword123!";

const adminClient = createClient(SUPABASE_URL, SERVICE_KEY);

const userEmail = `voice-test-${Date.now()}@example.com`;
const otherEmail = `voice-other-${Date.now()}@example.com`;
let testUserId: string;
let testProfileId: string;
let otherUserId: string;

beforeAll(async () => {
  const { data: userData, error: userError } = await adminClient.auth.admin.createUser({
    email: userEmail,
    password: TEST_PASSWORD,
    email_confirm: true,
  });
  if (userError) throw userError;
  testUserId = userData.user.id;

  const { data: profileData } = await adminClient
    .from("profiles")
    .select("id")
    .eq("auth_user_id", testUserId)
    .single();
  testProfileId = profileData!.id;

  const { data: otherData, error: otherError } = await adminClient.auth.admin.createUser({
    email: otherEmail,
    password: TEST_PASSWORD,
    email_confirm: true,
  });
  if (otherError) throw otherError;
  otherUserId = otherData.user.id;
});

afterAll(async () => {
  if (testProfileId) {
    await adminClient.from("voice_sessions").delete().eq("profile_id", testProfileId);
    await adminClient.from("profiles").delete().eq("id", testProfileId);
  }
  if (testUserId) {
    await adminClient.auth.admin.deleteUser(testUserId);
  }
  if (otherUserId) {
    const { data: otherProfile } = await adminClient
      .from("profiles")
      .select("id")
      .eq("auth_user_id", otherUserId)
      .single();
    if (otherProfile) {
      await adminClient.from("profiles").delete().eq("id", otherProfile.id);
    }
    await adminClient.auth.admin.deleteUser(otherUserId);
  }
});

describe("POST /api/voice/session — creates a voice_sessions row", () => {
  let sessionId: string;

  it("creates a voice_sessions row via the admin client", async () => {
    const { data, error } = await adminClient
      .from("voice_sessions")
      .insert({
        profile_id: testProfileId,
        status: "in_progress",
        transcript: "",
        extracted_data: {},
        duration_seconds: 0,
      })
      .select("id")
      .single();

    expect(error).toBeNull();
    expect(data?.id).toBeTruthy();
    sessionId = data!.id;
  });

  it("the voice_sessions row has the correct profile_id", async () => {
    const { data } = await adminClient
      .from("voice_sessions")
      .select("profile_id, status")
      .eq("profile_id", testProfileId)
      .single();

    expect(data?.profile_id).toBe(testProfileId);
    expect(data?.status).toBe("in_progress");
  });

  it("updates the session transcript correctly", async () => {
    const { data: session } = await adminClient
      .from("voice_sessions")
      .select("id")
      .eq("profile_id", testProfileId)
      .single();

    const { error } = await adminClient
      .from("voice_sessions")
      .update({ transcript: "User: Hello\nAgent: Hi there" })
      .eq("id", session!.id);

    expect(error).toBeNull();

    const { data: updated } = await adminClient
      .from("voice_sessions")
      .select("transcript")
      .eq("id", session!.id)
      .single();

    expect(updated?.transcript).toBe("User: Hello\nAgent: Hi there");
  });
});

describe("POST /api/voice/confirm — sets onboarding_status = complete", () => {
  it("can set onboarding_status to voice_complete then complete", async () => {
    await adminClient
      .from("profiles")
      .update({ onboarding_status: "voice_complete" })
      .eq("id", testProfileId);

    const { data: before } = await adminClient
      .from("profiles")
      .select("onboarding_status")
      .eq("id", testProfileId)
      .single();
    expect(before?.onboarding_status).toBe("voice_complete");

    await adminClient
      .from("profiles")
      .update({ onboarding_status: "complete" })
      .eq("id", testProfileId);

    const { data: after } = await adminClient
      .from("profiles")
      .select("onboarding_status")
      .eq("id", testProfileId)
      .single();
    expect(after?.onboarding_status).toBe("complete");
  });
});

describe("RLS — user cannot read another user's voice_sessions", () => {
  it("authenticated user can read their own voice session", async () => {
    const { data: session } = await adminClient
      .from("voice_sessions")
      .select("id")
      .eq("profile_id", testProfileId)
      .single();

    const anonClient = createClient(SUPABASE_URL, ANON_KEY);
    await anonClient.auth.signInWithPassword({ email: userEmail, password: TEST_PASSWORD });

    const { data, error } = await anonClient
      .from("voice_sessions")
      .select("id")
      .eq("id", session!.id)
      .single();

    expect(error).toBeNull();
    expect(data?.id).toBe(session!.id);
  });

  it("other user cannot read the first user's voice session", async () => {
    const { data: session } = await adminClient
      .from("voice_sessions")
      .select("id")
      .eq("profile_id", testProfileId)
      .single();

    const otherClient = createClient(SUPABASE_URL, ANON_KEY);
    await otherClient.auth.signInWithPassword({ email: otherEmail, password: TEST_PASSWORD });

    const { data } = await otherClient
      .from("voice_sessions")
      .select("id")
      .eq("id", session!.id)
      .single();

    expect(data).toBeNull();
  });
});
