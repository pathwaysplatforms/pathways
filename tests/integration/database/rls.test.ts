import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { describe, it, expect, beforeAll, afterAll } from "vitest";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_LOCAL_URL ??
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "http://127.0.0.1:54321";
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_LOCAL_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  "placeholder";
const SUPABASE_SECRET_KEY =
  process.env.SUPABASE_LOCAL_SECRET_KEY ??
  process.env.SUPABASE_SECRET_KEY ??
  "placeholder";

const TEST_PASSWORD = "TestPassword123!";

/** Service-role client that bypasses RLS — for test setup and teardown only. */
const adminClient = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY);

/** Returns an authenticated client for the given user credentials. */
async function signInAs(email: string): Promise<SupabaseClient> {
  const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data, error } = await anonClient.auth.signInWithPassword({
    email,
    password: TEST_PASSWORD,
  });
  if (error) throw new Error(`signInAs ${email}: ${error.message}`);
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${data.session.access_token}` } },
  });
}

const emailA = `rls-user-a-${Date.now()}@example.com`;
const emailB = `rls-user-b-${Date.now()}@example.com`;

let userAId: string;
let userBId: string;
let profileAId: string;
let profileBId: string;
let applicationAId: string;

beforeAll(async () => {
  const { data: ua, error: uaErr } = await adminClient.auth.admin.createUser({
    email: emailA,
    password: TEST_PASSWORD,
    email_confirm: true,
  });
  if (uaErr) throw uaErr;
  userAId = ua.user.id;

  const { data: ub, error: ubErr } = await adminClient.auth.admin.createUser({
    email: emailB,
    password: TEST_PASSWORD,
    email_confirm: true,
  });
  if (ubErr) throw ubErr;
  userBId = ub.user.id;

  const { data: pA } = await adminClient
    .from("profiles")
    .select("id")
    .eq("auth_user_id", userAId)
    .single();
  profileAId = pA!.id;

  const { data: pB } = await adminClient
    .from("profiles")
    .select("id")
    .eq("auth_user_id", userBId)
    .single();
  profileBId = pB!.id;

  const { data: pathway } = await adminClient
    .from("pathways")
    .select("id")
    .limit(1)
    .single();

  const { data: app, error: appErr } = await adminClient
    .from("applications")
    .insert({ profile_id: profileAId, pathway_id: pathway!.id, status: "draft" })
    .select("id")
    .single();
  if (appErr) throw appErr;
  applicationAId = app!.id;
});

afterAll(async () => {
  // Delete in FK-safe order: application → profiles → auth users
  if (applicationAId) await adminClient.from("applications").delete().eq("id", applicationAId);
  if (profileAId) await adminClient.from("profiles").delete().eq("id", profileAId);
  if (profileBId) await adminClient.from("profiles").delete().eq("id", profileBId);
  if (userAId) await adminClient.auth.admin.deleteUser(userAId);
  if (userBId) await adminClient.auth.admin.deleteUser(userBId);
});

describe("profiles isolation", () => {
  it("a user can read their own profile", async () => {
    const client = await signInAs(emailA);
    const { data, error } = await client
      .from("profiles")
      .select("id")
      .eq("id", profileAId);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it("a user cannot read another user's profile", async () => {
    const client = await signInAs(emailB);
    const { data, error } = await client
      .from("profiles")
      .select("id")
      .eq("id", profileAId);
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it("a user cannot update another user's profile", async () => {
    const client = await signInAs(emailB);
    // RLS silently blocks the update — 0 rows affected, no error
    const { data, error } = await client
      .from("profiles")
      .update({ full_name: "Attacker" })
      .eq("id", profileAId)
      .select("id");
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });
});

describe("applications isolation", () => {
  it("a user can read their own application", async () => {
    const client = await signInAs(emailA);
    const { data, error } = await client
      .from("applications")
      .select("id")
      .eq("id", applicationAId);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it("a user cannot read another user's application", async () => {
    const client = await signInAs(emailB);
    const { data, error } = await client
      .from("applications")
      .select("id")
      .eq("id", applicationAId);
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it("a user cannot insert an application for another user's profile", async () => {
    const client = await signInAs(emailB);
    const { data: pathway } = await adminClient
      .from("pathways")
      .select("id")
      .limit(1)
      .single();
    const { error } = await client
      .from("applications")
      .insert({ profile_id: profileAId, pathway_id: pathway!.id, status: "draft" });
    expect(error).not.toBeNull();
  });
});

describe("application documents isolation", () => {
  it("a user cannot read another user's documents", async () => {
    const client = await signInAs(emailB);
    const { data, error } = await client
      .from("application_documents")
      .select("id")
      .eq("application_id", applicationAId);
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });
});

describe("audit_log access control", () => {
  it("audit_log cannot be inserted by an authenticated user", async () => {
    const client = await signInAs(emailA);
    const { error } = await client.from("audit_log").insert({
      profile_id: profileAId,
      action: "test.action",
      entity_type: "profile",
      entity_id: profileAId,
    });
    expect(error).not.toBeNull();
  });

  it("audit_log cannot be inserted by the anon role", async () => {
    const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { error } = await anonClient.from("audit_log").insert({
      action: "test.action",
      entity_type: "profile",
      entity_id: profileAId,
    });
    expect(error).not.toBeNull();
  });
});

describe("pathways access control", () => {
  it("pathways are readable by any authenticated user", async () => {
    const client = await signInAs(emailA);
    const { data, error } = await client.from("pathways").select("id, title");
    expect(error).toBeNull();
    expect(data).toBeDefined();
  });

  it("pathways are not readable by the anon role", async () => {
    // RLS has no SELECT policy for anon — PostgREST returns [] + 200, not an error
    const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data, error } = await anonClient.from("pathways").select("id");
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it("pathways are not mutable by a regular authenticated user", async () => {
    const client = await signInAs(emailA);
    const { error } = await client.from("pathways").insert({
      country_id: "00000000-0000-0000-0000-000000000000",
      category_id: "00000000-0000-0000-0000-000000000000",
      title: "Injected Pathway",
      slug: "injected-pathway",
      official_name: "Injected",
      description: "Should not exist",
      processing_time_min: "1 day",
      processing_time_max: "1 day",
      fee_gbp: 0,
    });
    expect(error).not.toBeNull();
  });
});
