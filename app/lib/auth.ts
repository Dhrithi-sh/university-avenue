import "server-only";

import { createSupabaseAuthServerClient } from "./supabase/server";
import type { Tables } from "./database.types";

export type UserProfile = Tables<"profiles">;

function throwInDevelopment(message: string, error: unknown): void {
  console.error(`[University Avenue] ${message}:`, error);
  if (process.env.NODE_ENV === "development") {
    throw new Error(`[University Avenue] ${message}`, { cause: error });
  }
}

export async function getVerifiedUserId(): Promise<string | null> {
  const supabase = await createSupabaseAuthServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase.auth.getClaims();
  if (error) {
    throwInDevelopment("Could not verify the Supabase session", error);
    return null;
  }

  return typeof data?.claims?.sub === "string" ? data.claims.sub : null;
}

export async function getCurrentProfile(): Promise<UserProfile | null> {
  const supabase = await createSupabaseAuthServerClient();
  if (!supabase) return null;

  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError) {
    console.error("[University Avenue] Could not verify the signed-in profile session:", claimsError);
    return null;
  }

  const userId = claimsData?.claims?.sub;
  if (typeof userId !== "string") return null;

  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) {
    console.error("[University Avenue] Could not load the signed-in profile:", error);
    return null;
  }

  return data;
}
