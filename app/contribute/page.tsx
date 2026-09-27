import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthNotice } from "../components/auth-notice";
import { Eyebrow, Shell } from "../components/site";
import { getCurrentProfile } from "../lib/auth";
import { createSupabaseAuthServerClient } from "../lib/supabase/server";
import { getSections } from "../lib/data";
import type { ContentStatus, Tables } from "../lib/database.types";

export const dynamic = "force-dynamic";

const statusLabels: Record<ContentStatus, string> = {
  draft: "Draft",
  pending_review: "In review",
  changes_requested: "Changes requested",
  published: "Published",
  rejected: "Not accepted",
  archived: "Archived",
};

function updatedLabel(value: string): string {
  return new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
}

export default async function ContributePage({ searchParams }: { searchParams: Promise<{ error?: string; notice?: string }> }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login?next=%2Fcontribute");
  if (profile.status !== "active") redirect("/login?error=account-suspended");

  const params = await searchParams;
  const supabase = await createSupabaseAuthServerClient();
  if (!supabase) redirect("/login?error=configuration");

  const { data: articles, error } = await supabase.from("articles")
    .select("id,title,slug,status,updated_at,submitted_at,section_id")
    .eq("owner_profile_id", profile.id)
    .order("updated_at", { ascending: false });
  if (error) console.error("[University Avenue] Could not load contributor articles:", error);

  const ownArticleIds = (articles ?? []).map(article => article.id);
  const reviewNotesResult = ownArticleIds.length
    ? await supabase.from("article_review_notes").select("id,article_id,note,created_at,decision").in("article_id", ownArticleIds).order("created_at", { ascending: true })
    : { data: [], error: null };
  if (reviewNotesResult.error) console.error("[University Avenue] Could not load contributor review notes:", reviewNotesResult.error);
  const notesByArticle = new Map<string, Pick<Tables<"article_review_notes">, "id" | "article_id" | "note" | "created_at" | "decision">[]>();
  for (const review of reviewNotesResult.data ?? []) {
    const notes = notesByArticle.get(review.article_id) ?? [];
    notes.push(review);
    notesByArticle.set(review.article_id, notes);
  }

  const sections = await getSections();
  const sectionNames = new Map(sections.map(section => [section.id, section.name]));

  return <Shell><main className="wrap contributor-page">
    <header className="contributor-heading">
      <div><Eyebrow>{profile.role === "admin" ? "EDITORIAL ACCOUNT" : "CONTRIBUTOR DESK"}</Eyebrow><h1>Your stories.</h1><p>Welcome, {profile.display_name}. Draft something new, or pick up where you left off.</p></div>
      <Link className="button contributor-new" href="/contribute/new">New story <span>↗</span></Link>
    </header>
    <AuthNotice error={error || reviewNotesResult.error ? "load" : params.error} notice={params.notice}/>
    <section className="contributor-list" aria-labelledby="your-work-heading">
      <div className="contributor-list-heading"><h2 id="your-work-heading">Your work</h2><span>{articles?.length ?? 0} {articles?.length === 1 ? "story" : "stories"}</span></div>
      {articles?.length ? <div className="submission-list">{articles.map(article => {
        const editable = article.status === "draft" || article.status === "changes_requested";
        return <article className="submission-row" key={article.id}>
          <div className="submission-main"><div className="submission-meta"><span>{sectionNames.get(article.section_id) ?? "University Avenue"}</span><b>·</b><time dateTime={article.updated_at}>Updated {updatedLabel(article.updated_at)}</time></div>
            <h3>{article.title || "Untitled story"}</h3>
            {article.status === "pending_review" && <p className="submission-hint">Your story is with the editors. You’ll be able to make changes if they request them.</p>}
            {notesByArticle.get(article.id)?.map(note => note.note && <p className="submission-review-note" key={note.id}><strong>{statusLabels[note.decision]} · {updatedLabel(note.created_at)}</strong>{note.note}</p>)}
          </div>
          <div className="submission-actions"><span className={`submission-status status-${article.status.replaceAll("_", "-")}`}>{statusLabels[article.status]}</span>
            {editable ? <Link href={`/contribute/${article.id}/edit`} aria-label={`Edit ${article.title || "untitled story"}`}>Edit ↗</Link> : <Link href={`/contribute/${article.id}/edit`} aria-label={`View ${article.title || "untitled story"}`}>View ↗</Link>}
          </div>
        </article>;
      })}</div> : <div className="contributor-empty"><p>{error ? "Your stories could not be loaded just now." : "You haven’t started a story yet."}</p>{!error && <Link className="text-link" href="/contribute/new">Write your first story <span>↗</span></Link>}</div>}
    </section>
  </main></Shell>;
}
