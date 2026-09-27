import Link from "next/link";
import { Shell, Eyebrow } from "../components/site";
import { AuthNotice } from "../components/auth-notice";
import { signIn } from "../lib/actions/auth";

type LoginSearchParams = Promise<{ error?: string; notice?: string; next?: string }>;

export default async function LoginPage({ searchParams }: { searchParams: LoginSearchParams }) {
  const params = await searchParams;
  const next = params.next?.startsWith("/") && !params.next.startsWith("//") ? params.next : "/contribute";

  return <Shell><main className="wrap auth-main"><section className="auth-panel"><Eyebrow>WELCOME BACK</Eyebrow><h1>Sign in</h1><p className="auth-lede">Continue to your University Avenue account.</p><AuthNotice error={params.error} notice={params.notice}/><form action={signIn} className="auth-form"><input type="hidden" name="next" value={next}/><label htmlFor="login-email">Email address</label><input id="login-email" name="email" type="email" autoComplete="email" required/><label htmlFor="login-password">Password</label><input id="login-password" name="password" type="password" autoComplete="current-password" required/><button className="button auth-submit" type="submit">Sign in <span>↗</span></button></form><p className="auth-footnote"><Link href="/forgot-password">Forgot your password?</Link></p><p className="auth-footnote">New here? <Link href={`/signup?next=${encodeURIComponent(next)}`}>Become a contributor</Link></p></section></main></Shell>;
}
