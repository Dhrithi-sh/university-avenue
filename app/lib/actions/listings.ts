"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "../auth";
import { createSupabaseAuthServerClient } from "../supabase/server";

type ListingKind = "events" | "opportunities";
const statuses = new Set(["draft", "published", "archived"]);
function field(data: FormData, name: string): string {
  const value = data.get(name);
  return typeof value === "string" ? value.trim() : "";
}
function nullable(value: string): string | null { return value || null; }
function slugPart(title: string): string {
  return title.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 72).replace(/-+$/g, "") || "listing";
}
function safeUrl(value: string): string | null | false {
  if (!value) return null;
  if (value.length > 2048) return false;
  try { const url = new URL(value); return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : false; }
  catch { return false; }
}
function validDate(value: string): boolean { return !value || /^\d{4}-\d{2}-\d{2}$/.test(value); }
function route(kind: ListingKind, id?: string): string { return `/admin/${kind}${id ? `/${id}` : ""}`; }

async function adminContext() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login?next=%2Fadmin");
  if (profile.status !== "active") redirect("/login?error=account-suspended");
  if (profile.role !== "admin") redirect("/contribute?error=admin-required");
  const supabase = await createSupabaseAuthServerClient();
  if (!supabase) redirect("/login?error=configuration");
  return supabase;
}

export async function saveListing(data: FormData): Promise<void> {
  const supabase = await adminContext();
  const kind = field(data, "kind") as ListingKind;
  if (kind !== "events" && kind !== "opportunities") redirect("/admin?error=listing");
  const id = field(data, "id");
  const target = route(kind, id || undefined);
  const title = field(data, "title");
  const category = field(data, "category");
  const status = field(data, "status");
  const imageUrl = safeUrl(field(data, "image_url"));
  const suppliedListingUrl = field(data, kind === "events" ? "event_url" : "application_url");
  const listingUrl = suppliedListingUrl ? safeUrl(suppliedListingUrl) : null;
  if (!title || title.length > 240 || !category || category.length > 100 || !statuses.has(status) || imageUrl === false || listingUrl === false) redirect(`${target}?error=invalid-input`);

  let payload: Record<string, string | boolean | null>;
  if (kind === "events") {
    const date = field(data, "event_date");
    if (!validDate(date) || !date) redirect(`${target}?error=invalid-input`);
    payload = { title, event_date: date, start_time: nullable(field(data, "start_time")), end_time: nullable(field(data, "end_time")), location: nullable(field(data, "location")), description: nullable(field(data, "description")), category, image_url: imageUrl, event_url: listingUrl, organizer: nullable(field(data, "organizer")), status };
  } else {
    const deadline = field(data, "deadline");
    if (!validDate(deadline)) redirect(`${target}?error=invalid-input`);
    const opensAt = field(data, "opens_at");
    const parsedOpensAt = opensAt ? new Date(opensAt) : null;
    if (!parsedOpensAt || Number.isNaN(parsedOpensAt.getTime())) redirect(`${target}?error=invalid-input`);
    const organization = field(data, "organization");
    const description = field(data, "description");
    if (organization.length > 200 || description.length > 5000) redirect(`${target}?error=invalid-input`);
    // The existing columns are NOT NULL; empty strings keep these fields optional
    // in the editor without requiring a schema change.
    payload = { title, category, organization, description, opens_at: parsedOpensAt.toISOString(), deadline: nullable(deadline), eligibility: nullable(field(data, "eligibility")), location: nullable(field(data, "location")), mode: nullable(field(data, "mode")), application_url: listingUrl, action_label: field(data, "action_label") || "Learn more", image_url: imageUrl, status };
  }

  let error;
  if (id) {
    const result = await supabase.from(kind).update(payload as never).eq("id", id).select("id").maybeSingle();
    error = result.error;
    if (!error && !result.data) redirect(`${target}?error=not-found`);
  } else {
    const slug = `${slugPart(title)}-${randomUUID()}`;
    const result = kind === "events"
      ? await supabase.from("events").insert({ ...payload, slug } as never)
      : await supabase.from("opportunities").insert({ ...payload, slug } as never);
    error = result.error;
  }
  if (error) {
    console.error(`[University Avenue] Could not save ${kind.slice(0, -1)}:`, error);
    redirect(`${target}?error=save`);
  }
  revalidatePath("/"); revalidatePath(`/${kind}`); revalidatePath("/sitemap.xml"); revalidatePath(`/admin/${kind}`);
  redirect(`/admin/${kind}?notice=${id ? "updated" : "created"}`);
}

export async function deleteListing(data: FormData): Promise<void> {
  const supabase = await adminContext();
  const kind = field(data, "kind") as ListingKind;
  const id = field(data, "id");
  if ((kind !== "events" && kind !== "opportunities") || !/^[0-9a-f-]{36}$/i.test(id)) redirect("/admin?error=delete");
  const { data: record, error: checkError } = await supabase.from(kind).select("id,is_sample").eq("id", id).maybeSingle();
  if (checkError || !record) redirect(`${route(kind, id)}?error=listing-delete`);
  if (record.is_sample) redirect(`${route(kind, id)}?error=sample-protected`);
  const { data: deleted, error } = await supabase.from(kind).delete().eq("id", id).eq("is_sample", false).select("id").maybeSingle();
  if (error || !deleted) {
    console.error(`[University Avenue] Could not delete ${kind.slice(0, -1)}:`, error);
    redirect(`${route(kind, id)}?error=listing-delete`);
  }
  revalidatePath("/"); revalidatePath(`/${kind}`); revalidatePath("/sitemap.xml"); revalidatePath(`/admin/${kind}`);
  redirect(`/admin/${kind}?notice=deleted`);
}
