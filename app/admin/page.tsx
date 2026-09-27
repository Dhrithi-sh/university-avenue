import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthNotice } from "../components/auth-notice";
import { Eyebrow, Shell } from "../components/site";
import { getCurrentProfile } from "../lib/auth";
import { createSupabaseAuthServerClient } from "../lib/supabase/server";
import type { ContentStatus } from "../lib/database.types";
import { AdminNavigation } from "./admin-navigation";

export const dynamic = "force-dynamic";

const labels: Record<ContentStatus, string> = { draft: "Draft", pending_review: "In review", changes_requested: "Changes requested", published: "Published", rejected: "Not accepted", archived: "Archived" };

function dateLabel(value: string): string {
  return new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
}

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ error?: string; notice?: string }> }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login?next=%2Fadmin");
  if (profile.status !== "active") redirect("/login?error=account-suspended");
  if (profile.role !== "admin") redirect("/contribute?error=admin-required");

  const [supabase, params] = await Promise.all([createSupabaseAuthServerClient(), searchParams]);
  if (!supabase) redirect("/login?error=configuration");

  const [pendingResult, recentResult] = await Promise.all([
    supabase.from("articles").select("id,title,status,created_at,updated_at,submitted_at,owner_profile_id,is_sample")
      .eq("status", "pending_review").order("submitted_at", { ascending: true }),
    supabase.from("articles").select("id,title,status,created_at,updated_at,submitted_at,owner_profile_id,is_sample")
      .not("owner_profile_id", "is", null).neq("status", "pending_review")
      .order("updated_at", { ascending: false }).limit(8),
  ]);
  if (pendingResult.error) console.error("[University Avenue] Could not load editorial queue:", pendingResult.error);
  if (recentResult.error) console.error("[University Avenue] Could not load recently updated contributor articles:", recentResult.error);
  const pending = pendingResult.data ?? [];
  const recent = recentResult.data ?? [];

  const profileIds = [...new Set([...pending, ...recent].flatMap(article => article.owner_profile_id ? [article.owner_profile_id] : []))];
  const profileQuery = profileIds.length
    ? supabase.from("profiles").select("id,display_name,email").in("id", profileIds)
    : Promise.resolve({ data: [], error: null });
  const [{ data: contributorProfiles, error: profilesError }] = await Promise.all([profileQuery]);
  if (profilesError) console.error("[University Avenue] Could not load contributor identities for review:", profilesError);
  const contributors = new Map((contributorProfiles ?? []).map(contributor => [contributor.id, contributor]));
  const queryError = pendingResult.error || recentResult.error || profilesError;

  return <Shell><main className="wrap contributor-page admin-page">
    <header className="contributor-heading"><div><Eyebrow>EDITORIAL DESK · {profile.display_name.toUpperCase()}</Eyebrow><h1>Review queue.</h1><p>Stories sent in by contributors, ready for an editorial decision.</p></div></header>
    <AdminNavigation active="stories"/>
    <AuthNotice error={queryError ? "load" : params.error} notice={params.notice}/>
    <section className="contributor-list" aria-labelledby="pending-heading">
      <div className="contributor-list-heading"><h2 id="pending-heading">Pending review</h2><span>{pending.length} {pending.length === 1 ? "story" : "stories"}</span></div>
      {pending.length ? <div className="submission-list">{pending.map(article => {
        const author = article.owner_profile_id ? contributors.get(article.owner_profile_id) : null;
        return <article className="submission-row" key={article.id}>
          <div className="submission-main"><div className="submission-meta"><span>{author?.display_name ?? "Contributor account"}</span><b>·</b><time dateTime={article.updated_at}>Updated {dateLabel(article.updated_at)}</time></div><h3>{article.title || "Untitled story"}</h3><p className="submission-hint">Submitted {article.submitted_at ? dateLabel(article.submitted_at) : dateLabel(article.created_at)}</p></div>
          <div className="submission-actions"><span className="submission-status status-pending-review">{labels[article.status]}</span><Link href={`/admin/articles/${article.id}`}>Review ↗</Link></div>
        </article>;
      })}</div> : <p className="contributor-empty">{queryError ? "The review queue could not be loaded." : "There are no stories waiting for review."}</p>}
    </section>
    {recent.length > 0 && <section className="contributor-list admin-recent" aria-labelledby="recent-heading"><div className="contributor-list-heading"><h2 id="recent-heading">Other contributor stories</h2></div><div className="submission-list">{recent.map(article => <article className="submission-row" key={article.id}><div className="submission-main"><div className="submission-meta"><span>{article.owner_profile_id ? contributors.get(article.owner_profile_id)?.display_name ?? "Contributor account" : "Contributor account"}</span><b>·</b><time dateTime={article.updated_at}>Updated {dateLabel(article.updated_at)}</time></div><h3>{article.title || "Untitled story"}</h3></div><div className="submission-actions"><span className={`submission-status status-${article.status.replaceAll("_", "-")}`}>{labels[article.status]}</span><Link href={`/admin/articles/${article.id}`}>Open ↗</Link></div></article>)}</div></section>}
  </main></Shell>;
}
