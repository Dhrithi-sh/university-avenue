import { notFound } from "next/navigation";
import Link from "next/link";
import { getArticlesForSection, getEvents, getOpportunities, getPublishedArticles } from "../lib/data";
import { Eyebrow, SectionHeading, Shell, StoryCard } from "../components/site";

const intros: Record<string, { title: string; deck: string }> = { snu: { title: "Spotlight on SNU", deck: "Campus chatter, major (and small) events, someone spotting a cloud shaped like a lion– it’s all here!" }, people: { title: "People", deck: "Meet students, faculty, and even alumni. They’re cool people!" }, ideas: { title: "Editorial – Contributor perspectives", deck: "Join us on a journey through different perspectives that shed light on how we learn, live, and belong." }, events: { title: "The Campus Calendar", deck: "Bored, and looking for something to do? Take a moment to peruse through campus activities– you’re sure to find something you love." }, opportunities: { title: "Room to begin.", deck: "Open calls, research support, internships and ways to take your next step." } };
export const dynamic = "force-dynamic";

export default async function SectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const key = section.toLowerCase();
  if (key === "about") return <About />;

  const intro = intros[key];
  if (!intro) notFound();

  const [list, events, opportunities] = await Promise.all([
    key === "snu" ? getPublishedArticles() : getArticlesForSection(key),
    key === "events" ? getEvents() : Promise.resolve([]),
    key === "opportunities" ? getOpportunities() : Promise.resolve([]),
  ]);

  return <Shell><main className={`wrap section-page section-page-${key}`}><header className="page-intro"><Eyebrow>UNIVERSITY AVENUE / {key.toUpperCase()}</Eyebrow><h1 className={key === "ideas" ? "editorial-page-title" : undefined}>{intro.title}</h1><p>{intro.deck}</p></header>
    {key === "events" ? <div className="list-items">{events.length ? events.map(event => <article key={event.title}><Eyebrow>{event.type} · {event.month} {event.day}</Eyebrow><h2>{event.title}</h2><p>{event.detail}</p></article>) : <p className="empty-note">Nothing here yet.</p>}</div>
      : key === "opportunities" ? <div className="opportunities-columns">
        <section className="opportunity-deadlines" aria-label="Opportunities & Deadlines"><SectionHeading title="Opportunities & Deadlines" note="SAMPLE DATA · NOT VERIFIED CURRENT OPPORTUNITIES" />{opportunities.length ? <div className="events-strip">{opportunities.map(opportunity => <article className="event-item opportunity-item" key={opportunity.title}><div className="event-date"><b>{opportunity.deadlineDay}</b><span>{opportunity.deadlineMonth}</span></div><div className="opportunity-details"><small>{opportunity.isSample ? "SAMPLE LISTING · " : ""}{opportunity.category}</small><h3>{opportunity.title}</h3><p>{opportunity.detail}</p><p>{opportunity.organization} · Deadline: {opportunity.deadline}</p><p>Eligibility: {opportunity.eligibility} · {opportunity.location}</p>{opportunity.actionHref !== "/opportunities" && <a href={opportunity.actionHref}>{opportunity.actionLabel} ↗</a>}</div><span className="arrow" aria-hidden="true">↗</span></article>)}</div> : <p className="empty-note">Nothing here yet.</p>}</section>
        <section className="opportunity-stories" aria-label="Stories about opportunities"><SectionHeading title="Stories" note="REPORTING & EXPLAINERS" />{list.length ? <div className="opportunity-story-list">{list.map(story => <StoryCard key={story.slug} story={story} />)}</div> : <p className="empty-note">Nothing here yet.</p>}</section>
      </div>
      : <><SectionHeading title={key === "snu" ? "Recent dispatches" : `From the ${key === "ideas" ? "editorial" : key} desk`} note="STORIES & PERSPECTIVES" /><div className="listing-grid">{list.length ? list.map(story => <StoryCard key={story.slug} story={story} />) : <p className="empty-note">Nothing here yet.</p>}</div></>}
  </main></Shell>;
}

function About(){return <Shell><main className="wrap about-page"><header className="about-intro"><Eyebrow>ABOUT THE AVENUE · SNU</Eyebrow><h1>Hello, welcome to <em>University Avenue!</em></h1><p>An independent journal about the people, ideas and everyday life of a university community.</p></header><section className="about-copy" aria-label="About University Avenue"><div className="about-founder"><span>FOUNDED BY</span><Link href="/authors/dhrithi-shashibushan">Dhrithi Shashibushan <b>↗</b></Link></div><div className="about-prose"><p>We begin at Shiv Nadar University, where a changing campus offers an endless supply of stories worth noticing.</p><p>We strive to offer you a collection of stories covering anything interesting, important, and relevant happening on campus.</p><p>This is an independent student-led publication, with the goal of showcasing how life truly unfolds at university, beyond the glamourous curation of a pamphlet. It is a platform meant to cater to professors, parents, alumni, recruiters, and ofcourse– the students, both current and aspiring.</p><p>Our first edition is a starting point. Over time, University Avenue hopes to connect campus communities across India and the world through a shared love for writing, new ideas, and honest journalism.</p></div></section><section className="about-contact" id="contact"><Eyebrow>GET IN TOUCH · YOUR CAMPUS, YOUR STORIES</Eyebrow><div className="about-contact-layout"><h2>We hope that you will walk this avenue with us</h2><p>Have a story or question for us? We’d love to hear from you. Please reach out at <a href="mailto:hello@universityavenue.in">[email]</a>. Meet our contributors <Link href="/authors/dhrithi-shashibushan">[Go to contributor page.]</Link></p></div></section></main></Shell>}
