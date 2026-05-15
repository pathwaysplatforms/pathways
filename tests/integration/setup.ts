import { createClient } from "@supabase/supabase-js";

export const testSupabase = createClient(
  process.env.SUPABASE_URL ?? "http://localhost:54321",
  process.env.SUPABASE_ANON_KEY ?? "placeholder"
);

export async function cleanupTestData(
  table: string,
  condition: Record<string, string | number>
) {
  await testSupabase.from(table).delete().match(condition);
}
