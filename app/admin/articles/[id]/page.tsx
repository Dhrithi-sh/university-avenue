import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AuthNotice } from "../../../components/auth-notice";
import { Eyebrow, Shell } from "../../../components/site";
import { deleteArticle, reviewArticle, setContributorAuthor } from "../../../lib/actions/articles";
import { DeleteArticleButton } from "../../delete-article-button";
import { getCurrentProfile } from "../../../lib/auth";
import { getSections } from "../../../lib/data";
import type { ContentStatus, Json } from "../../../lib/database.types";
import { createSupabaseAuthServerClient } from "../../../lib/supabase/server";

export const dynamic = "force-dynamic";

const labels: Record<ContentStatus, string> = { draft: "Draft", pending_review: "In review", changes_requested: "Changes requested", published: "Published", rejected: "Not accepted", archived: "Archived" };

function dateTime(value: string): string {
  return new Intl.DateTimeFormat("en", { dateStyle: "long", timeStyle: "short" }).format(new Date(value));
}

function paragraphs(body: Json): string[] {
  if (!Array.isArray(body)) return [];
  return body.flatMap(value => typeof value === "string" ? [value] : []);
}

export default async function AdminArticlePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; notice?: string }> }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login?next=%2Fadmin");
  if (profile.status !== "active") redirect("/login?error=account-suspended");
  if (profile.role !== "admin") redirect("/contribute?error=admin-required");

  const [{ id }, query, supabase, sections] = await Promise.all([params, searchParams, createSupabaseAuthServerClient(), getSections()]);
  if (!supabase || !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id)) notFound();

  const { data: article, error } = await supabase.from("articles").select(
    "id,slug,title,dek,excerpt,body,published_at,read_time_minutes,image_url,image_alt,section_id,author_id,owner_profile_id,status,created_at,updated_at,submitted_at,reviewed_at,is_sample,seo_title,seo_description",
  ).eq("id", id).maybeSingle();
  if (error) console.error("[University Avenue] Could not load article for editorial review:", error);
  if (!article) notFound();

  const [ownerResult, authorResult, authorsResult, historyResult] = await Promise.all([
    article.owner_profile_id ? supabase.from("profiles").select("id,display_name,email,author_id").eq("id", article.owner_profile_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    article.author_id ? supabase.from("authors").select("id,name,slug,is_public").eq("id", article.author_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    supabase.from("authors").select("id,name,slug").eq("is_public", true).order("name"),
    supabase.from("article_review_notes").select("id,reviewer_profile_id,decision,note,created_at").eq("article_id", id).order("created_at", { ascending: true }),
  ]);
  const mappedAuthorResult = ownerResult.data?.author_id
    ? await supabase.from("authors").select("id,name,slug,is_public").eq("id", ownerResult.data.author_id).maybeSingle()
    : { data: null, error: null };

  for (const [label, result] of [["contributor", ownerResult], ["byline", authorResult], ["public authors", authorsResult], ["review history", historyResult]] as const) {
    if (result.error) console.error(`[University Avenue] Could not load ${label} for editorial review:`, result.error);
  }
  if (mappedAuthorResult.error) console.error("[University Avenue] Could not load contributor's public byline:", mappedAuthorResult.error);
  const auxiliaryError = Boolean(ownerResult.error || authorResult.error || authorsResult.error || historyResult.error || mappedAuthorResult.error);

  const reviewerIds = [...new Set((historyResult.data ?? []).map(entry => entry.reviewer_profile_id))];
  const reviewersResult = reviewerIds.length
    ? await supabase.from("profiles").select("id,display_name").in("id", reviewerIds)
    : { data: [], error: null };
  if (reviewersResult.error) console.error("[University Avenue] Could not load reviewer names:", reviewersResult.error);
  const reviewers = new Map((reviewersResult.data ?? []).map(reviewer => [reviewer.id, reviewer.display_name]));
  const authorName = ownerResult.data?.display_name ?? "Contributor account";
  const sectionName = sections.find(section => section.id === article.section_id)?.name ?? "University Avenue";
  const pending = article.status === "pending_review";
  const published = article.status === "published";
  const displayedByline = ["published", "archived"].includes(article.status)
    ? authorResult.data?.name ?? "Not assigned"
    : mappedAuthorResult.data?.name ?? "Not assigned";

  return <Shell><main className="wrap review-page">
    <Link className="writing-back" href="/admin">← Editorial queue</Link>
    <header className="review-heading"><div><Eyebrow>{sectionName.toUpperCase()} · {labels[article.status].toUpperCase()}</Eyebrow><h1>{article.title || "Untitled story"}</h1><p>{article.dek || "No dek has been added."}</p></div><span className={`submission-status status-${article.status.replaceAll("_", "-")}`}>{labels[article.status]}</span></header>
    {(error || auxiliaryError || query.error || query.notice) && <AuthNotice error={query.error ?? (error || auxiliaryError ? "load" : undefined)} notice={query.notice}/>}
    <div className="review-columns">
      <article className="review-manuscript">
        <div className="review-byline"><span>Contributor account</span><strong>{authorName}</strong>{ownerResult.data?.email && <a href={`mailto:${ownerResult.data.email}`}>{ownerResult.data.email}</a>}<span>Created {dateTime(article.created_at)}</span><span>Updated {dateTime(article.updated_at)}</span>{article.submitted_at && <span>Submitted {dateTime(article.submitted_at)}</span>}{article.published_at && <span>Published {dateTime(article.published_at)}</span>}</div>
        {article.image_url && <figure className="review-image-figure"><div className="review-image-preview" role="img" aria-label={article.image_alt || article.title || "Featured story image"} style={{ backgroundImage: `url("${article.image_url}")` }}/>{article.image_alt?.trim() && <figcaption>{article.image_alt}</figcaption>}<a href={article.image_url} target="_blank" rel="noreferrer">Open image ↗</a></figure>}
        <div className="review-body">{paragraphs(article.body).length ? paragraphs(article.body).map((paragraph, index) => <p key={`${index}-${paragraph.slice(0, 24)}`}>{paragraph}</p>) : <p className="review-empty-body">No story text has been added.</p>}</div>
        <section className="review-history" aria-labelledby="review-history-heading"><div className="contributor-list-heading"><h2 id="review-history-heading">Editorial history</h2></div>{historyResult.data?.length ? historyResult.data.map(entry => <article className="review-history-entry" key={entry.id}><div><span className={`submission-status status-${entry.decision.replaceAll("_", "-")}`}>{labels[entry.decision]}</span><time dateTime={entry.created_at}>{dateTime(entry.created_at)}</time></div><p className="reviewer-name">{reviewers.get(entry.reviewer_profile_id) ?? "Editorial team"}</p>{entry.note && <p className="review-note-text">{entry.note}</p>}</article>) : <p className="review-history-empty">No editorial decisions have been recorded.</p>}</section>
      </article>
      <aside className="review-controls" aria-label="Editorial controls">
        <div className="review-controls-heading"><Eyebrow>EDITORIAL DESK</Eyebrow><h2>Review this story</h2></div>
        <p className="review-current-byline">{["published", "archived"].includes(article.status) ? "Public story byline" : "Contributor public byline"}: <strong>{displayedByline}</strong></p>
        {ownerResult.data && <section className="review-author-mapping"><h3>Contributor’s public author</h3><p>Associate this account with an existing public profile once. New stories will use this byline automatically.</p><form action={setContributorAuthor} className="review-form"><input type="hidden" name="article_id" value={article.id}/><input type="hidden" name="profile_id" value={ownerResult.data.id}/><label htmlFor="mapped-author">Public author profile</label><select id="mapped-author" name="author_id" defaultValue={ownerResult.data.author_id ?? ""}><option value="">Choose an existing public author</option>{authorsResult.data?.map(author => <option key={author.id} value={author.id}>{author.name}</option>)}</select><button className="review-text-action" type="submit">Save contributor mapping</button></form></section>}
        {pending ? <form action={reviewArticle} className="review-form"><input type="hidden" name="id" value={article.id}/><label htmlFor="review-note">Note to contributor <span>Required for requested changes or rejection · optional for publication</span></label><textarea id="review-note" name="reviewer_note" rows={7} maxLength={5000} placeholder="Share specific guidance for the next revision."/><button className="button review-action" type="submit" name="decision" value="changes_requested">Request changes</button><button className="review-text-action" type="submit" name="decision" value="rejected">Reject story</button><button className="button review-publish-action" type="submit" name="decision" value="published" disabled={!mappedAuthorResult.data?.is_public}>Publish story <span>↗</span></button>{!mappedAuthorResult.data?.is_public && <p className="review-field-note">Save an existing public author mapping for this contributor before publishing.</p>}</form>
          : published ? <form action={reviewArticle} className="review-form"><input type="hidden" name="id" value={article.id}/><label htmlFor="archive-note">Internal note <span>Optional</span></label><textarea id="archive-note" name="reviewer_note" rows={4} maxLength={5000} placeholder="Add a note about archiving this story."/><button className="review-text-action" type="submit" name="decision" value="archived">Archive this story</button></form>
            : <p className="review-closed">This story is not currently awaiting an editorial decision.</p>}
        {ownerResult.data && <p className="review-mapped-author">Mapped contributor byline: <strong>{mappedAuthorResult.data?.name ?? "Not assigned"}</strong></p>}
        {["published", "rejected", "archived"].includes(article.status) && <form action={deleteArticle} className="review-delete-form"><input type="hidden" name="id" value={article.id}/><DeleteArticleButton/></form>}
        {authorResult.data && <Link className="review-public-author" href={`/authors/${authorResult.data.slug}`}>View public author profile ↗</Link>}
      </aside>
    </div>
  </main></Shell>;
}
