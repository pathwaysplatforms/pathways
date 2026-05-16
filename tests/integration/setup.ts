import { config as loadDotEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";

// Vitest deliberately skips .env.local in test mode for reproducibility.
// Integration tests need the real local Supabase credentials, so load it explicitly.
loadDotEnv({ path: ".env.local", override: false });

const DEFAULT_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRFA0NiK7UFwicknvljLQ12D_NYDggkjjdhfnlpTLCs";

export const testSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_LOCAL_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    "http://127.0.0.1:54321",
  process.env.NEXT_PUBLIC_SUPABASE_LOCAL_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    DEFAULT_ANON_KEY
);

export async function cleanupTestData(
  table: string,
  condition: Record<string, string | number>
) {
  await testSupabase.from(table).delete().match(condition);
}
