import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AuthNotice } from "../../../components/auth-notice";
import { Eyebrow, Shell } from "../../../components/site";
import { saveDraft, submitForReview } from "../../../lib/actions/articles";
import { getCurrentProfile } from "../../../lib/auth";
import { getSections } from "../../../lib/data";
import { createSupabaseAuthServerClient } from "../../../lib/supabase/server";
import type { ContentStatus, Json } from "../../../lib/database.types";

export const dynamic = "force-dynamic";

const labels: Record<ContentStatus, string> = { draft: "Draft", pending_review: "In review", changes_requested: "Changes requested", published: "Published", rejected: "Not accepted", archived: "Archived" };

function paragraphText(body: Json): string {
  return Array.isArray(body) ? body.filter((item): item is string => typeof item === "string").join("\n\n") : "";
}

export default async function EditStoryPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; notice?: string }> }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login?next=%2Fcontribute");
  if (profile.status !== "active") redirect("/login?error=account-suspended");
  const [{ id }, query, sections, supabase] = await Promise.all([params, searchParams, getSections(), createSupabaseAuthServerClient()]);
  if (!supabase || !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id)) notFound();

  const { data: article, error } = await supabase.from("articles")
    .select("id,title,slug,dek,body,section_id,image_url,image_alt,author_id,published_at,status,updated_at")
    .eq("id", id).eq("owner_profile_id", profile.id).maybeSingle();
  if (error) console.error("[University Avenue] Could not load contributor article:", error);
  if (!article) notFound();

  const editable = article.status === "draft" || article.status === "changes_requested";
  const sectionSlug = sections.find(section => section.id === article.section_id)?.slug ?? "";
  const storySections = sections.filter(section => ["snu", "people", "ideas", "opportunities"].includes(section.slug));
  const [historyResult, authorResult] = await Promise.all([
    !editable ? supabase.from("article_review_notes").select("id,decision,note,created_at").eq("article_id", article.id).order("created_at", { ascending: true }) : Promise.resolve({ data: [], error: null }),
    article.author_id ? supabase.from("authors").select("name,slug").eq("id", article.author_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ]);
  if (historyResult.error) console.error("[University Avenue] Could not load contributor article history:", historyResult.error);
  if (authorResult.error) console.error("[University Avenue] Could not load contributor story byline:", authorResult.error);
  return <Shell><main className="wrap writing-page">
    <Link className="writing-back" href="/contribute">← Your stories</Link>
    <header className="writing-heading"><Eyebrow>{labels[article.status].toUpperCase()}</Eyebrow><h1>{editable ? article.title || "Untitled story" : article.title || "Story submitted"}</h1><p>{article.status === "pending_review" ? "Your story is with the editors. It is locked while they review it." : article.status === "changes_requested" ? "The editors have asked for changes. Make your revisions and send it back when it’s ready." : editable ? "You can keep working on this draft, or submit it when it’s ready." : "This story is read only."}</p></header>
    <AuthNotice error={query.error} notice={query.notice}/>
    {editable ? <form action={saveDraft} className="writing-form">
      <input type="hidden" name="id" value={article.id}/>
      <label htmlFor="story-title">Title</label><input id="story-title" name="title" type="text" maxLength={240} defaultValue={article.title}/>
      <label htmlFor="story-dek">Dek <span>A short introduction to your story</span></label><textarea id="story-dek" name="dek" rows={2} maxLength={500} defaultValue={article.dek}/>
      <label htmlFor="story-body">Story</label><textarea id="story-body" name="body" rows={14} maxLength={100000} defaultValue={paragraphText(article.body)} placeholder="Separate paragraphs with a blank line."/>
      <label htmlFor="story-section">Section</label><select id="story-section" name="section" required defaultValue={sectionSlug}><option value="" disabled>Choose a section</option>{storySections.map(section => <option key={section.id} value={section.slug}>{section.name === "Ideas" ? "Editorial" : section.name === "Opportunities" ? "Opportunities · Stories" : section.name}</option>)}</select>
      <fieldset className="writing-image-fields"><legend>Featured image <span>Optional · use an existing public image URL</span></legend><label htmlFor="story-image">Image URL</label><input id="story-image" name="image_url" type="url" maxLength={2048} defaultValue={article.image_url ?? ""} placeholder="https://"/><label htmlFor="story-image-alt">Image description</label><input id="story-image-alt" name="image_alt" type="text" maxLength={300} defaultValue={article.image_alt ?? ""}/></fieldset>
      <div className="writing-actions"><button className="button" type="submit">Save draft <span>↗</span></button><button className="button writing-submit" type="submit" formAction={submitForReview}>Submit for review <span>↗</span></button><p>Submission requires a title, dek and at least one paragraph. Once submitted, the story is locked during review.</p></div>
    </form> : <>
      <section className="writing-locked"><span className={`submission-status status-${article.status.replaceAll("_", "-")}`}>{labels[article.status]}</span><p>{article.status === "pending_review" ? "You can’t edit a story while it is in review." : "This story is read only. Its editorial notes and full text remain here for reference."}</p>
        {authorResult.data && <p className="writing-publication">By <Link href={`/authors/${authorResult.data.slug}`}>{authorResult.data.name}</Link>{article.status === "published" && <> · Published {article.published_at ? new Intl.DateTimeFormat("en", { dateStyle: "long" }).format(new Date(article.published_at)) : ""}</>}</p>}
        {article.image_url && <figure className="writing-image-preview"><div role="img" aria-label={article.image_alt || article.title || "Featured story image"} style={{ backgroundImage: `url("${article.image_url}")` }}/>{article.image_alt?.trim() && <figcaption>{article.image_alt}</figcaption>}</figure>}
        <h2>{article.title || "Untitled story"}</h2><p className="writing-preview-dek">{article.dek}</p>
        <div className="writing-preview-body">{paragraphText(article.body).split("\n\n").filter(Boolean).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>
        {article.status === "published" && <Link className="text-link" href={`/stories/${article.slug}`}>Open public story ↗</Link>}
      </section>
      <section className="writing-history" aria-labelledby="writing-history-heading"><div className="contributor-list-heading"><h2 id="writing-history-heading">Editorial history</h2></div>{historyResult.data?.length ? historyResult.data.map(entry => <article className="review-history-entry" key={entry.id}><div><span className={`submission-status status-${entry.decision.replaceAll("_", "-")}`}>{labels[entry.decision]}</span><time dateTime={entry.created_at}>{new Intl.DateTimeFormat("en", { dateStyle: "long", timeStyle: "short" }).format(new Date(entry.created_at))}</time></div>{entry.note && <p className="review-note-text">{entry.note}</p>}</article>) : <p className="review-history-empty">No editorial decisions have been recorded.</p>}</section>
    </>}
  </main></Shell>;
}
