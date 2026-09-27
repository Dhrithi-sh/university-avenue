import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { getArticleBySlug, getPublishedArticles } from "../../lib/data";
import { Eyebrow, Shell, StoryCard } from "../../components/site";

export const dynamic = "force-dynamic";

type StoryPageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: StoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const story = await getArticleBySlug(slug);
  if (!story) return {};

  const title = story.seoTitle ?? story.title;
  const description = story.seoDescription ?? story.dek;
  return { title, description, openGraph: { type: "article", title, description, images: story.image ? [story.image] : [] } };
}

export default async function StoryPage({ params }: StoryPageProps) {
  const { slug } = await params;
  const [story, articles] = await Promise.all([getArticleBySlug(slug), getPublishedArticles()]);
  if (!story) notFound();
  const more = articles.filter(article => article.slug !== slug).slice(0, 2);

  return <Shell><main className="wrap"><div className="article-layout"><article><header className="article-head"><Eyebrow>{story.section} · {story.date}</Eyebrow><h1>{story.title}</h1><p className="dek">{story.dek}</p><div className="article-byline">By <Link href={`/authors/${story.authorSlug}`}>{story.author}</Link><span>{story.read}</span></div></header><div className="article-cover" role="img" aria-label={story.imageAlt} style={{ backgroundImage: story.image ? `url("${story.image}")` : undefined }} /><div className="article-body">{story.body.map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div></article><aside className="article-aside"><small>THE AVENUE</small><p>University Avenue</p><Link href="/snu" className="text-link">More from SNU ↗</Link></aside></div><section className="section-block"><div className="section-heading"><div><Eyebrow>KEEP READING</Eyebrow><h2>More from the avenue</h2></div></div>{more.length ? <div className="listing-grid">{more.map(article => <StoryCard key={article.slug} story={article} />)}</div> : <p className="empty-note">Nothing here yet.</p>}</section></main></Shell>;
}
