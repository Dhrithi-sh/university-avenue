import Link from "next/link";
import { getArticleBySlug, getEvents, getOpportunities, getPublishedArticles } from "./lib/data";
import { Eyebrow, SectionHeading, Shell, StoryCard } from "./components/site";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [stories, events, opportunities, editorial] = await Promise.all([
    getPublishedArticles(),
    getEvents(),
    getOpportunities(),
    getArticleBySlug("who-gets-to-feel-at-home"),
  ]);
  const lead = stories.find(story => story.featured) ?? stories[0];
  const secondary = stories.filter(story => story !== lead).slice(0, 3);

  return <Shell><main><section className="hero wrap"><div className="hero-copy"><Eyebrow>AN INDEPENDENT CAMPUS JOURNAL</Eyebrow><p className="hero-kicker">You’d never believe what happened today… if we hadn’t recorded it!</p><h1>University life, <em>honestly narrated.</em></h1><p className="hero-dek">People, communities, academia, ideas – and everything else that makes our campus… well, SNU!</p><Link className="button" href="/snu">Explore the journal <span>↗</span></Link></div><div className="hero-photo" style={{backgroundImage: lead?.image ? `url("${lead.image}")` : undefined}}><span className="photo-caption">A campus after the rain · SNU</span></div></section>
    <div className="wrap ticker"><span>NOW ON THE AVENUE</span><p>Stories from a university in motion</p><Link href="/about">Who we are ↗</Link></div>
    <section className="wrap section-block"><SectionHeading title="On the avenue" note="THE LATEST" href="/snu"/>{lead ? <div className="story-grid"><StoryCard story={lead} feature/><div className="secondary-stories">{secondary.map(story=><StoryCard key={story.slug} story={story}/>)}</div></div> : <p className="empty-note">Nothing here yet.</p>}</section>
    <section className="ideas-band"><div className="wrap ideas-layout"><div><Eyebrow>THE CAMPUS, IN QUESTION</Eyebrow><h2>Editorials</h2><p>Join us on a journey through different perspectives that shed light on how we learn, live, and belong.</p><Link className="button button-light" href="/ideas">Read the editorial desk ↗</Link></div>{editorial ? <StoryCard story={editorial}/> : <p className="empty-note">Nothing here yet.</p>}</div></section>
    <section className="wrap section-block"><SectionHeading title="Coming together" note="AROUND CAMPUS" href="/events"/>{events.length ? <div className="events-strip">{events.map(event=><article className="event-item" key={event.title}><div className="event-date"><b>{event.day}</b><span>{event.month}</span></div><div><small>{event.type}</small><h3>{event.title}</h3><p>{event.detail}</p></div><span className="arrow">↗</span></article>)}</div> : <p className="empty-note">Nothing here yet.</p>}</section>
    <section className="wrap section-block opportunities-block"><div><Eyebrow>ROOM TO GROW</Eyebrow><h2>Opportunities</h2><p>Open OCJ positions, research support, internship opportunities– one stop shop to plan your next move.</p><Link className="text-link" href="/opportunities">Browse opportunities ↗</Link></div>{opportunities.length ? <div className="opportunity-preview">{opportunities.slice(0,2).map(opportunity=><article key={opportunity.title}><small>{opportunity.label}</small><h3>{opportunity.title}</h3><p>{opportunity.detail}</p><Link href="/opportunities">Learn more ↗</Link></article>)}</div> : <p className="empty-note">Nothing here yet.</p>}</section></main></Shell>;
}
