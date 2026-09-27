"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "../auth";
import { createSupabaseAuthServerClient } from "../supabase/server";

const EDITORIAL_SECTION_SLUGS = new Set(["snu", "people", "ideas", "opportunities"]);

function value(formData: FormData, key: string): string {
  const entry = formData.get(key);
  return typeof entry === "string" ? entry.trim() : "";
}

function bodyParagraphs(text: string): string[] {
  return text.split(/\n\s*\n/).map(paragraph => paragraph.trim()).filter(Boolean);
}

function withinEditorialLimits(formData: FormData): boolean {
  return value(formData, "title").length <= 240
    && value(formData, "dek").length <= 500
    && value(formData, "body").length <= 100_000
    && value(formData, "image_alt").length <= 300;
}

function slugPart(title: string): string {
  return title.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 72).replace(/-+$/g, "");
}

function imageUrl(formData: FormData): string | null | "invalid" {
  const raw = value(formData, "image_url");
  if (!raw) return null;
  if (raw.length > 2048) return "invalid";
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : "invalid";
  } catch {
    return "invalid";
  }
}

async function contributorContext() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login?next=%2Fcontribute");
  if (profile.status !== "active") redirect("/login?error=account-suspended");

  const supabase = await createSupabaseAuthServerClient();
  if (!supabase) redirect("/contribute?error=configuration");
  return { profile, supabase };
}

async function sectionIdForSlug(supabase: Awaited<ReturnType<typeof createSupabaseAuthServerClient>>, slug: string): Promise<string | null> {
  if (!supabase || !EDITORIAL_SECTION_SLUGS.has(slug)) return null;
  const { data, error } = await supabase.from("sections").select("id").eq("slug", slug).eq("is_active", true).maybeSingle();
  if (error) console.error("[University Avenue] Could not validate article section:", error);
  return data?.id ?? null;
}

export async function createDraft(formData: FormData): Promise<void> {
  const { profile, supabase } = await contributorContext();
  if (!withinEditorialLimits(formData)) redirect("/contribute/new?error=invalid-input");
  const sectionId = await sectionIdForSlug(supabase, value(formData, "section"));
  const image = imageUrl(formData);
  if (!sectionId) redirect("/contribute/new?error=section");
  if (image === "invalid") redirect("/contribute/new?error=image");

  const title = value(formData, "title");
  const idSuffix = randomUUID();
  const slug = `${slugPart(title) || "untitled-story"}-${idSuffix}`;
  const { data, error } = await supabase.from("articles").insert({
    slug,
    title,
    dek: value(formData, "dek"),
    body: bodyParagraphs(value(formData, "body")),
    section_id: sectionId,
    owner_profile_id: profile.id,
    image_url: image,
    image_alt: image ? value(formData, "image_alt") || title || null : null,
  }).select("id").single();

  if (error || !data) {
    console.error("[University Avenue] Could not create article draft:", error);
    redirect("/contribute/new?error=save");
  }
  redirect(`/contribute/${data.id}/edit?notice=draft-saved`);
}

export async function saveDraft(formData: FormData): Promise<void> {
  const { profile, supabase } = await contributorContext();
  const id = value(formData, "id");
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id)) redirect("/contribute?error=not-editable");
  if (!withinEditorialLimits(formData)) redirect(`/contribute/${id}/edit?error=invalid-input`);
  const sectionId = await sectionIdForSlug(supabase, value(formData, "section"));
  const image = imageUrl(formData);
  if (!sectionId) redirect(`/contribute/${id}/edit?error=section`);
  if (image === "invalid") redirect(`/contribute/${id}/edit?error=image`);

  const title = value(formData, "title");
  const { data, error } = await supabase.from("articles").update({
    title,
    dek: value(formData, "dek"),
    body: bodyParagraphs(value(formData, "body")),
    section_id: sectionId,
    image_url: image,
    image_alt: image ? value(formData, "image_alt") || title || null : null,
  }).eq("id", id).eq("owner_profile_id", profile.id)
    .in("status", ["draft", "changes_requested"]).select("id").maybeSingle();

  if (error || !data) {
    console.error("[University Avenue] Could not save article draft:", error);
    redirect("/contribute?error=not-editable");
  }
  redirect(`/contribute/${id}/edit?notice=draft-saved`);
}

export async function submitForReview(formData: FormData): Promise<void> {
  const { supabase } = await contributorContext();
  const id = value(formData, "id");
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id)) redirect("/contribute?error=not-editable");

  const { error } = await supabase.rpc("submit_article_for_review", { target_article_id: id });
  if (error) {
    console.error("[University Avenue] Could not submit article for review:", error);
    const message = error.message.toLowerCase().includes("title and dek") ? "required-fields"
      : error.message.toLowerCase().includes("story text") ? "story-text"
        : "submit";
    redirect(`/contribute/${id}/edit?error=${message}`);
  }
  redirect("/contribute?notice=submitted");
}

export async function reviewArticle(formData: FormData): Promise<void> {
  const { profile, supabase } = await contributorContext();
  const id = value(formData, "id");
  const decision = value(formData, "decision");
  const allowedDecisions = ["changes_requested", "rejected", "published", "archived"];
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id) || !allowedDecisions.includes(decision)) {
    redirect("/admin?error=review");
  }
  if (profile.role !== "admin") redirect("/contribute?error=admin-required");

  const note = value(formData, "reviewer_note");
  if (note.length > 5000) redirect(`/admin/articles/${id}?error=note-length`);
  if (["changes_requested", "rejected"].includes(decision) && !note) redirect(`/admin/articles/${id}?error=note-required`);

  const { error } = await supabase.rpc("editorial_review_article", {
    target_article_id: id,
    decision,
    target_author_id: null,
    reviewer_note: note || null,
  });
  if (error) {
    console.error("[University Avenue] Editorial decision failed:", error);
    const errorCode = error.message.toLowerCase().includes("public byline") || error.message.toLowerCase().includes("public author")
      ? "author"
      : error.message.toLowerCase().includes("reviewer note") ? "note-required" : "review";
    redirect(`/admin/articles/${id}?error=${errorCode}`);
  }

  revalidatePath("/admin");
  revalidatePath(`/admin/articles/${id}`);
  revalidatePath("/contribute");
  revalidatePath("/");
  revalidatePath("/sitemap.xml");
  redirect(`/admin?notice=${decision === "changes_requested" ? "changes-requested" : decision}`);
}

export async function setContributorAuthor(formData: FormData): Promise<void> {
  const { profile, supabase } = await contributorContext();
  const articleId = value(formData, "article_id");
  const profileId = value(formData, "profile_id");
  const authorId = value(formData, "author_id");
  if (profile.role !== "admin") redirect("/contribute?error=admin-required");
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(articleId)
    || !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(profileId)
    || (authorId && !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(authorId))) {
    redirect("/admin?error=author");
  }

  const { error } = await supabase.rpc("set_contributor_author", {
    target_profile_id: profileId,
    target_author_id: authorId || null,
  });
  if (error) {
    console.error("[University Avenue] Could not update contributor author mapping:", error);
    redirect(`/admin/articles/${articleId}?error=author`);
  }
  revalidatePath("/admin");
  revalidatePath(`/admin/articles/${articleId}`);
  revalidatePath("/contribute");
  redirect(`/admin/articles/${articleId}?notice=author-mapped`);
}

export async function deleteArticle(formData: FormData): Promise<void> {
  const { profile, supabase } = await contributorContext();
  const id = value(formData, "id");
  if (profile.role !== "admin") redirect("/contribute?error=admin-required");
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id)) redirect("/admin?error=delete");

  const { error } = await supabase.rpc("delete_editorial_article", { target_article_id: id });
  if (error) {
    console.error("[University Avenue] Could not delete article:", error);
    redirect(`/admin/articles/${id}?error=delete`);
  }
  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath("/sitemap.xml");
  redirect("/admin?notice=deleted");
}
