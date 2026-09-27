import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthNotice } from "../components/auth-notice";
import { Eyebrow, Shell } from "../components/site";
import { getCurrentProfile } from "../lib/auth";
import { createSupabaseAuthServerClient } from "../lib/supabase/server";
import type { Tables } from "../lib/database.types";
import { AdminNavigation } from "./admin-navigation";
import { ListingEditor } from "./listing-editor";

export type ListingKind = "events" | "opportunities";
const configs = {
  events: { title: "Events", fields: "id,title,event_date,start_time,location,category,status,is_sample,updated_at" },
  opportunities: { title: "Opportunities & deadlines", fields: "id,title,category,organization,deadline,status,is_sample,updated_at" },
} as const;
export async function requireAdmin() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login?next=%2Fadmin");
  if (profile.status !== "active") redirect("/login?error=account-suspended");
  if (profile.role !== "admin") redirect("/contribute?error=admin-required");
  const supabase = await createSupabaseAuthServerClient();
  if (!supabase) redirect("/login?error=configuration");
  return { profile, supabase };
}
function prettyDate(value: string | null) {
  if (!value) return "No date set";
  return new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(value));
}
function label(status: string) { return status.charAt(0).toUpperCase() + status.slice(1).replaceAll("_", " "); }

export async function ListingIndex({ kind, searchParams }: { kind: ListingKind; searchParams: Promise<{ error?: string; notice?: string }> }) {
  const { profile, supabase } = await requireAdmin();
  const [result, params] = await Promise.all([
    supabase.from(kind).select(configs[kind].fields).order(kind === "events" ? "event_date" : "deadline", { ascending: true, nullsFirst: false }),
    searchParams,
  ]);
  if (result.error) console.error(`[University Avenue] Could not load admin ${kind}:`, result.error);
  const records = (result.data ?? []) as unknown as Array<Record<string, string | boolean | null>>;
  const active = kind === "events" ? "events" : "opportunities";
  return <Shell><main className="wrap contributor-page admin-page admin-listings-page">
    <header className="contributor-heading"><div><Eyebrow>EDITORIAL DESK · {profile.display_name.toUpperCase()}</Eyebrow><h1>{configs[kind].title}.</h1><p>Structured listings, managed by the editorial desk.</p></div><Link className="writing-submit admin-create-link" href={`/admin/${kind}/new`}>Create {kind === "events" ? "event" : "opportunity"} ↗</Link></header>
    <AdminNavigation active={active}/><AuthNotice error={result.error ? "load" : params.error} notice={params.notice}/>
    <section className="contributor-list"><div className="contributor-list-heading"><h2>All listings</h2><span>{records.length} total</span></div>
      {records.length ? <div className="submission-list">{records.map(record => <article className="submission-row" key={String(record.id)}><div className="submission-main"><div className="submission-meta"><span>{label(String(record.status))}</span><b>·</b><time>{prettyDate(String(record.event_date ?? record.deadline ?? "") || null)}</time>{record.is_sample && <b>· Sample</b>}</div><h3>{String(record.title)}</h3><p className="submission-hint">{kind === "events" ? String(record.category) : `${String(record.organization)} · ${String(record.category)}`}</p></div><div className="submission-actions"><Link href={`/admin/${kind}/${String(record.id)}`}>Edit ↗</Link></div></article>)}</div> : <p className="contributor-empty">{result.error ? "These listings could not be loaded." : "Nothing here yet."}</p>}
    </section>
  </main></Shell>;
}

export async function ListingCreate({ kind, searchParams }: { kind: ListingKind; searchParams: Promise<{ error?: string }> }) {
  const { profile } = await requireAdmin();
  const params = await searchParams;
  return <Shell><main className="wrap contributor-page admin-page admin-listings-page"><header className="contributor-heading"><div><Eyebrow>EDITORIAL DESK · {profile.display_name.toUpperCase()}</Eyebrow><h1>New {kind === "events" ? "event" : "opportunity"}.</h1><p>Add a structured listing for the campus community.</p></div></header><AdminNavigation active={kind}/>{params.error && <AuthNotice error={params.error}/>}<ListingEditor kind={kind}/></main></Shell>;
}

export async function ListingEdit({ kind, id, searchParams }: { kind: ListingKind; id: string; searchParams: Promise<{ error?: string }> }) {
  const { profile, supabase } = await requireAdmin();
  const [result, params] = await Promise.all([supabase.from(kind).select("*").eq("id", id).maybeSingle(), searchParams]);
  if (result.error) console.error(`[University Avenue] Could not load ${kind.slice(0, -1)}:`, result.error);
  if (!result.data) redirect(`/admin/${kind}?error=load`);
  const values = result.data as unknown as Tables<typeof kind>;
  return <Shell><main className="wrap contributor-page admin-page admin-listings-page"><header className="contributor-heading"><div><Eyebrow>EDITORIAL DESK · {profile.display_name.toUpperCase()}</Eyebrow><h1>Edit listing.</h1><p>Adjust its details or change whether it appears publicly.</p></div></header><AdminNavigation active={kind}/>{params.error && <AuthNotice error={params.error}/>}<ListingEditor kind={kind} values={values as unknown as Record<string, string | boolean | null>} existing/></main></Shell>;
}
