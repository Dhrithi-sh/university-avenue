import type { Metadata } from "next";
import { stories } from "../../lib/content";
import { Eyebrow, Shell, StoryCard } from "../../components/site";
export const metadata:Metadata={title:"Dhrithi Shashibushan",description:"Stories by Dhrithi Shashibushan for University Avenue."};
export default function AuthorPage(){return <Shell><main className="wrap"><section className="author-intro"><div className="author-portrait" aria-hidden="true">DS</div><div><Eyebrow>CONTRIBUTOR · SHIV NADAR UNIVERSITY</Eyebrow><h1>Dhrithi Shashibushan</h1><p>Dhrithi writes about the places, people and everyday rituals that make a university community. She is a contributing writer at University Avenue.</p></div></section><section className="section-block"><div className="section-heading"><div><Eyebrow>BY DHRITHI</Eyebrow><h2>Stories & dispatches</h2></div></div><div className="listing-grid">{stories.map(s=><StoryCard key={s.slug} story={s}/>)}</div></section></main></Shell>}
