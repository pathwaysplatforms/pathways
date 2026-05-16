import { config as loadDotEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import ws from "ws";

loadDotEnv({ path: ".env.local", override: false });

const DEFAULT_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRFA0NiK7UFwicknvljLQ12D_NYDggkjjdhfnlpTLCs";
const DEFAULT_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hj04zWl196z2-SB38";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_LOCAL_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "http://127.0.0.1:54321";

const ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_LOCAL_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  DEFAULT_ANON_KEY;

const SERVICE_KEY =
  process.env.SUPABASE_LOCAL_SECRET_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  DEFAULT_SERVICE_KEY;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const clientOptions = { realtime: { transport: ws as any } };

export const testSupabase = createClient(SUPABASE_URL, ANON_KEY, clientOptions);
export const adminClient = createClient(SUPABASE_URL, SERVICE_KEY, clientOptions);

export async function cleanupTestData(
  table: string,
  condition: Record<string, string | number>
) {
  await adminClient.from(table).delete().match(condition);
}
