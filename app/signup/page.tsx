import Link from "next/link";
import { Shell, Eyebrow } from "../components/site";
import { AuthNotice } from "../components/auth-notice";
import { signUp } from "../lib/actions/auth";

type SignupSearchParams = Promise<{ error?: string; notice?: string; next?: string }>;

export default async function SignupPage({ searchParams }: { searchParams: SignupSearchParams }) {
  const params = await searchParams;
  const next = params.next?.startsWith("/") && !params.next.startsWith("//") ? params.next : "/contribute";

  return <Shell><main className="wrap auth-main"><section className="auth-panel"><Eyebrow>JOIN THE AVENUE</Eyebrow><h1>Become a contributor</h1><p className="auth-lede">Create an account to take your first step with University Avenue.</p><AuthNotice error={params.error} notice={params.notice}/><form action={signUp} className="auth-form"><input type="hidden" name="next" value={next}/><label htmlFor="signup-name">Your name</label><input id="signup-name" name="display_name" type="text" autoComplete="name" minLength={2} maxLength={120} required/><label htmlFor="signup-email">Email address</label><input id="signup-email" name="email" type="email" autoComplete="email" required/><label htmlFor="signup-password">Password</label><input id="signup-password" name="password" type="password" autoComplete="new-password" minLength={8} required/><p className="auth-help">Use at least 8 characters. We’ll ask you to verify your email address.</p><button className="button auth-submit" type="submit">Create account <span>↗</span></button></form><p className="auth-footnote">Already have an account? <Link href={`/login?next=${encodeURIComponent(next)}`}>Sign in</Link></p></section></main></Shell>;
}
