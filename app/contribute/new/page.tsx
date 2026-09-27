import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthNotice } from "../../components/auth-notice";
import { Eyebrow, Shell } from "../../components/site";
import { createDraft } from "../../lib/actions/articles";
import { getCurrentProfile } from "../../lib/auth";
import { getSections } from "../../lib/data";

export const dynamic = "force-dynamic";

export default async function NewStoryPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login?next=%2Fcontribute%2Fnew");
  if (profile.status !== "active") redirect("/login?error=account-suspended");
  const [sections, params] = await Promise.all([getSections(), searchParams]);
  const storySections = sections.filter(section => ["snu", "people", "ideas", "opportunities"].includes(section.slug));

  return <Shell><main className="wrap writing-page">
    <Link className="writing-back" href="/contribute">← Your stories</Link>
    <header className="writing-heading"><Eyebrow>NEW STORY · {profile.display_name.toUpperCase()}</Eyebrow><h1>Start with a draft.</h1><p>Save what you have. You can return to the story before sending it to the editors.</p></header>
    <AuthNotice error={params.error}/>
    <form action={createDraft} className="writing-form">
      <label htmlFor="story-title">Title</label><input id="story-title" name="title" type="text" maxLength={240} placeholder="A working headline"/>
      <label htmlFor="story-dek">Dek <span>A short introduction to your story</span></label><textarea id="story-dek" name="dek" rows={2} maxLength={500} placeholder="What should readers know before they begin?"/>
      <label htmlFor="story-body">Story</label><textarea id="story-body" name="body" rows={12} maxLength={100000} placeholder="Write your story. Separate paragraphs with a blank line."/>
      <label htmlFor="story-section">Section</label><select id="story-section" name="section" required defaultValue=""><option value="" disabled>Choose a section</option>{storySections.map(section => <option key={section.id} value={section.slug}>{section.name === "Ideas" ? "Editorial" : section.name === "Opportunities" ? "Opportunities · Stories" : section.name}</option>)}</select>
      <fieldset className="writing-image-fields"><legend>Featured image <span>Optional · use an existing public image URL</span></legend><label htmlFor="story-image">Image URL</label><input id="story-image" name="image_url" type="url" maxLength={2048} placeholder="https://"/><label htmlFor="story-image-alt">Image description</label><input id="story-image-alt" name="image_alt" type="text" maxLength={300} placeholder="Describe the image for readers using a screen reader"/></fieldset>
      <div className="writing-actions"><button className="button" type="submit">Save draft <span>↗</span></button><p>A title, dek and story text are only needed when you submit for review.</p></div>
    </form>
  </main></Shell>;
}
