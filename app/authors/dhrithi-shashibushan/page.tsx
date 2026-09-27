import type { Metadata } from "next";
import { getArticlesByAuthor, getAuthorBySlug } from "../../lib/data";
import { Eyebrow, Shell, StoryCard } from "../../components/site";

export const dynamic = "force-dynamic";

const founderSlug = "dhrithi-shashibushan";

export async function generateMetadata(): Promise<Metadata> {
  const author = await getAuthorBySlug(founderSlug);
  return author ? { title: author.name, description: author.seoDescription ?? author.bio } : {};
}

export default async function AuthorPage() {
  const [author, stories] = await Promise.all([getAuthorBySlug(founderSlug), getArticlesByAuthor(founderSlug)]);
  const fallbackName = "Dhrithi Shashibushan";
  const displayName = author?.name || fallbackName;
  const initials = displayName.split(" ").map(part => part[0]).join("");
  const givenName = displayName.split(" ")[0] || "AUTHOR";

  return <Shell><main className="wrap"><section className="author-intro"><div className="author-portrait" aria-hidden={author?.photo ? undefined : true} role={author?.photo ? "img" : undefined} aria-label={author?.photo ? displayName : undefined} style={author?.photo ? { backgroundImage: `url("${author.photo}")`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}>{author?.photo ? null : initials}</div><div>{author?.role && <Eyebrow>{author.role}</Eyebrow>}<h1>{displayName}</h1>{author ? author.bio.split(/\n{2,}/).map(paragraph => <p key={paragraph}>{paragraph}</p>) : <p className="empty-note">Nothing here yet.</p>}</div></section><section className="section-block"><div className="section-heading"><div><Eyebrow>BY {givenName.toUpperCase()}</Eyebrow><h2>Stories & dispatches</h2></div></div>{stories.length ? <div className="listing-grid">{stories.map(story => <StoryCard key={story.slug} story={story} />)}</div> : <p className="empty-note">Nothing here yet.</p>}</section></main></Shell>;
}
