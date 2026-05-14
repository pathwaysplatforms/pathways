import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../types/database";

let browserClient: SupabaseClient<Database> | null = null;

/** Browser/client-side Supabase client (anon key). */
export function getSupabaseBrowserClient(): SupabaseClient<Database> {
  if (browserClient) return browserClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  browserClient = createClient<Database>(url, anonKey);
  return browserClient;
}
