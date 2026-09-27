import { redirect } from "next/navigation";
import { Shell, Eyebrow } from "../components/site";
import { AuthNotice } from "../components/auth-notice";
import { updatePassword } from "../lib/actions/auth";
import { getVerifiedUserId } from "../lib/auth";

type ResetSearchParams = Promise<{ error?: string }>;

export default async function ResetPasswordPage({ searchParams }: { searchParams: ResetSearchParams }) {
  const userId = await getVerifiedUserId();
  if (!userId) redirect("/forgot-password?error=reset-link-expired");
  const params = await searchParams;

  return <Shell><main className="wrap auth-main"><section className="auth-panel"><Eyebrow>ACCOUNT HELP</Eyebrow><h1>Choose a new password</h1><p className="auth-lede">Set a new password for your University Avenue account.</p><AuthNotice error={params.error}/><form action={updatePassword} className="auth-form"><label htmlFor="new-password">New password</label><input id="new-password" name="password" type="password" autoComplete="new-password" minLength={8} required/><label htmlFor="confirm-password">Confirm password</label><input id="confirm-password" name="confirm_password" type="password" autoComplete="new-password" minLength={8} required/><button className="button auth-submit" type="submit">Update password <span>↗</span></button></form></section></main></Shell>;
}
