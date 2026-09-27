"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseAuthServerClient } from "../supabase/server";

function formValue(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function safeNextPath(value: string, fallback: string): string {
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  return value;
}

async function requestOrigin(): Promise<string> {
  const requestHeaders = await headers();
  const origin = requestHeaders.get("origin");
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");

  if (origin && host) {
    try {
      const parsed = new URL(origin);
      if (parsed.host === host && (parsed.protocol === "https:" || parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1")) {
        return parsed.origin;
      }
    } catch {
      // Use the canonical fallback if the incoming origin is malformed.
    }
  }

  return process.env.NODE_ENV === "production" ? "https://universityavenue.in" : "http://localhost:3000";
}

function reportAuthError(action: string, error: unknown): void {
  console.error(`[University Avenue] Supabase Auth ${action} failed:`, error);
}

export async function signUp(formData: FormData): Promise<void> {
  const displayName = formValue(formData, "display_name");
  const email = formValue(formData, "email").toLowerCase();
  const next = safeNextPath(formValue(formData, "next"), "/contribute");
  const password = formData.get("password");

  if (displayName.length < 2 || displayName.length > 120 || !email || typeof password !== "string" || password.length < 8) {
    redirect("/signup?error=invalid-input");
  }

  const supabase = await createSupabaseAuthServerClient();
  if (!supabase) redirect("/signup?error=configuration");

  const origin = await requestOrigin();
  const callback = new URL("/auth/callback", origin);
  callback.searchParams.set("next", next);
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName }, emailRedirectTo: callback.toString() },
  });

  if (error) {
    reportAuthError("signup", error);
    redirect("/signup?error=signup-failed");
  }

  if (!data.session) redirect(`/login?notice=check-email&next=${encodeURIComponent(next)}`);
  redirect(next);
}

export async function signIn(formData: FormData): Promise<void> {
  const email = formValue(formData, "email").toLowerCase();
  const password = formData.get("password");
  const next = safeNextPath(formValue(formData, "next"), "/contribute");

  if (!email || typeof password !== "string" || !password) redirect("/login?error=invalid-input");

  const supabase = await createSupabaseAuthServerClient();
  if (!supabase) redirect("/login?error=configuration");

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    reportAuthError("sign-in", error);
    redirect("/login?error=invalid-credentials");
  }

  redirect(next);
}

export async function signOut(): Promise<void> {
  const supabase = await createSupabaseAuthServerClient();
  if (supabase) {
    const { error } = await supabase.auth.signOut();
    if (error) reportAuthError("sign-out", error);
  }

  redirect("/login?notice=signed-out");
}

export async function requestPasswordReset(formData: FormData): Promise<void> {
  const email = formValue(formData, "email").toLowerCase();
  if (!email) redirect("/forgot-password?error=invalid-input");

  const supabase = await createSupabaseAuthServerClient();
  if (!supabase) redirect("/forgot-password?error=configuration");

  const origin = await requestOrigin();
  const callback = new URL("/auth/callback", origin);
  callback.searchParams.set("next", "/reset-password");
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: callback.toString() });
  if (error) {
    reportAuthError("password reset request", error);
    redirect("/forgot-password?error=reset-failed");
  }

  redirect("/forgot-password?notice=reset-sent");
}

export async function updatePassword(formData: FormData): Promise<void> {
  const password = formData.get("password");
  const confirmation = formData.get("confirm_password");
  if (typeof password !== "string" || password.length < 8 || password !== confirmation) {
    redirect("/reset-password?error=invalid-password");
  }

  const supabase = await createSupabaseAuthServerClient();
  if (!supabase) redirect("/reset-password?error=configuration");

  const { data, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !data?.claims?.sub) redirect("/forgot-password?error=reset-link-expired");

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    reportAuthError("password update", error);
    redirect("/reset-password?error=password-update-failed");
  }

  redirect("/login?notice=password-updated");
}
