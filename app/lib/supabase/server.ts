import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";

export function createSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    const message = "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local, then restart Next.js.";
    if (process.env.NODE_ENV === "development") throw new Error(message);
    console.error(`[University Avenue] ${message}`);
    return null;
  }

  return createClient<Database>(url, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
