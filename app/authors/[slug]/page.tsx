import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Eyebrow, Shell, StoryCard } from "../../components/site";
import { getArticlesByProfile, getProfileBySlug } from "../../lib/data";

export const dynamic = "force-dynamic";

type AuthorPageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: AuthorPageProps): Promise<Metadata> {
  const { slug } = await params;
  const profile = await getProfileBySlug(slug);
  return profile ? { title: profile.name, description: profile.seoDescription ?? profile.bio } : {};
}

export default async function AuthorPage({ params }: AuthorPageProps) {
  const { slug } = await params;
  const [profile, stories] = await Promise.all([getProfileBySlug(slug), getArticlesByProfile(slug)]);
  if (!profile) notFound();
  const initials = profile.name.split(" ").map(part => part[0]).join("");
  const givenName = profile.name.split(" ")[0] || "CONTRIBUTOR";

  return <Shell><main className="wrap"><section className="author-intro"><div className="author-portrait" aria-hidden={profile.photo ? undefined : true} role={profile.photo ? "img" : undefined} aria-label={profile.photo ? profile.name : undefined} style={profile.photo ? { backgroundImage: `url("${profile.photo}")`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}>{profile.photo ? null : initials}</div><div>{profile.role && <Eyebrow>{profile.role}</Eyebrow>}<h1>{profile.name}</h1>{profile.bio ? profile.bio.split(/\n{2,}/).map(paragraph => <p key={paragraph}>{paragraph}</p>) : <p className="empty-note">Nothing here yet.</p>}</div></section><section className="section-block"><div className="section-heading"><div><Eyebrow>BY {givenName.toUpperCase()}</Eyebrow><h2>Stories & dispatches</h2></div></div>{stories.length ? <div className="listing-grid">{stories.map(story => <StoryCard key={story.slug} story={story} />)}</div> : <p className="empty-note">Nothing here yet.</p>}</section></main></Shell>;
}
