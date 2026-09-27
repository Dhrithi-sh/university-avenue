import Link from "next/link";
import { Shell, Eyebrow } from "../components/site";
import { AuthNotice } from "../components/auth-notice";
import { requestPasswordReset } from "../lib/actions/auth";

type ForgotSearchParams = Promise<{ error?: string; notice?: string }>;

export default async function ForgotPasswordPage({ searchParams }: { searchParams: ForgotSearchParams }) {
  const params = await searchParams;

  return <Shell><main className="wrap auth-main"><section className="auth-panel"><Eyebrow>ACCOUNT HELP</Eyebrow><h1>Reset your password</h1><p className="auth-lede">Enter the email address on your account and we’ll send a reset link if it’s registered.</p><AuthNotice error={params.error} notice={params.notice}/><form action={requestPasswordReset} className="auth-form"><label htmlFor="reset-email">Email address</label><input id="reset-email" name="email" type="email" autoComplete="email" required/><button className="button auth-submit" type="submit">Send reset link <span>↗</span></button></form><p className="auth-footnote"><Link href="/login">Back to sign in</Link></p></section></main></Shell>;
}
