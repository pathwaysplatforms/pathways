import { config as loadDotEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";

// Vitest deliberately skips .env.local in test mode for reproducibility.
// Integration tests need the real local Supabase credentials, so load it explicitly.
loadDotEnv({ path: ".env.local", override: false });

export const testSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_LOCAL_URL ?? "http://127.0.0.1:54321",
  process.env.NEXT_PUBLIC_SUPABASE_LOCAL_PUBLISHABLE_KEY ?? "placeholder"
);

export async function cleanupTestData(
  table: string,
  condition: Record<string, string | number>
) {
  await testSupabase.from(table).delete().match(condition);
}
