import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAuthServerClient } from "../../lib/supabase/server";

function localPath(value: string | null, fallback: string): string {
  return value?.startsWith("/") && !value.startsWith("//") && !value.includes("\\") ? value : fallback;
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = localPath(requestUrl.searchParams.get("next"), "/contribute");
  const supabase = await createSupabaseAuthServerClient();

  if (!code || !supabase) {
    return NextResponse.redirect(new URL("/login?error=verification-failed", requestUrl.origin));
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error("[University Avenue] Could not complete the Supabase Auth callback:", error);
    return NextResponse.redirect(new URL("/login?error=verification-failed", requestUrl.origin));
  }

  return NextResponse.redirect(new URL(next, requestUrl.origin));
}
