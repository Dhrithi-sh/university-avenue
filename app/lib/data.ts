import { cache } from "react";
import { createSupabaseServerClient } from "./supabase/server";
import type { Tables } from "./database.types";
import type { ContributorProfile, Event, Opportunity, Section, Story } from "./types";

type ArticleRelations = { section: Pick<Tables<"sections">, "name" | "slug" | "is_active"> };
type PublicProfile = { id: string; slug: string; display_name: string; role_title: string; bio: string; avatar_url: string | null; seo_description: string | null };

type ArticleRecord = Pick<Tables<"articles">, "id" | "slug" | "title" | "dek" | "excerpt" | "body" | "published_at" | "read_time_minutes" | "image_url" | "image_alt" | "is_featured" | "seo_title" | "seo_description" | "owner_profile_id"> & ArticleRelations;

const articleColumns = "id,slug,title,dek,excerpt,body,published_at,read_time_minutes,image_url,image_alt,is_featured,seo_title,seo_description,owner_profile_id,section:sections!articles_section_id_fkey!inner(name,slug,is_active)";

function reportQueryError(dataset: string, error: unknown) {
  console.error(`[University Avenue] Could not load ${dataset}:`, error);
  if (process.env.NODE_ENV === "development") {
    const message = error instanceof Error ? error.message : JSON.stringify(error);
    throw new Error(`[University Avenue] Could not load ${dataset}: ${message}`, { cause: error });
  }
}

function toStory(row: ArticleRecord, profile: PublicProfile): Story {
  const paragraphs = Array.isArray(row.body) ? row.body.filter((paragraph): paragraph is string => typeof paragraph === "string") : [];
  const date = row.published_at ? new Date(row.published_at) : null;

  return {
    slug: row.slug,
    title: row.title,
    dek: row.dek,
    section: row.section.name,
    date: date ? new Intl.DateTimeFormat("en-US", { month: "long", day: "2-digit", year: "numeric", timeZone: "UTC" }).format(date) : "",
    read: row.read_time_minutes ? `${row.read_time_minutes} min read` : "",
    image: row.image_url ?? "",
    imageAlt: row.image_alt ?? "",
    author: profile.display_name,
    authorSlug: profile.slug,
    body: paragraphs,
    featured: row.is_featured,
    seoTitle: row.seo_title,
    seoDescription: row.seo_description,
  };
}

function toContributorProfile(row: PublicProfile): ContributorProfile {
  return { slug: row.slug, name: row.display_name, role: row.role_title, bio: row.bio, photo: row.avatar_url, seoDescription: row.seo_description };
}

async function toStories(rows: ArticleRecord[]): Promise<Story[]> {
  const profileIds = [...new Set(rows.flatMap(row => row.owner_profile_id ? [row.owner_profile_id] : []))];
  if (!profileIds.length) return [];
  const supabase = createSupabaseServerClient();
  if (!supabase) return [];
  const { data, error } = await supabase.from("public_profiles").select("id,slug,display_name,role_title,bio,avatar_url,seo_description").in("id", profileIds);
  if (error) { reportQueryError("public contributor profiles", error); return []; }
  const profiles = new Map((data ?? []).map(profile => [profile.id, profile as PublicProfile]));
  return rows.flatMap(row => {
    const profile = row.owner_profile_id ? profiles.get(row.owner_profile_id) : undefined;
    return profile ? [toStory(row, profile)] : [];
  });
}

async function getPublicProfile(slug: string): Promise<PublicProfile | null> {
  const supabase = createSupabaseServerClient();
  if (!supabase) return null;
  const { data, error } = await supabase.from("public_profiles").select("id,slug,display_name,role_title,bio,avatar_url,seo_description").eq("slug", slug).maybeSingle();
  if (error) { reportQueryError(`public profile ${slug}`, error); return null; }
  return data as PublicProfile | null;
}

function toEvent(row: Tables<"events">): Event {
  const [year, monthNumber, dayNumber] = row.event_date.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 1, dayNumber));
  const month = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" }).format(date).toUpperCase();
  const start = row.start_time ? formatTime(row.start_time) : "";
  const detail = [row.location, start].filter(Boolean).join(" · ");
  return { day: String(dayNumber).padStart(2, "0"), month, title: row.title, detail, type: row.category };
}

function formatTime(time: string): string {
  const [hoursText, minutesText] = time.split(":");
  const hours = Number(hoursText);
  const period = hours >= 12 ? "pm" : "am";
  return `${hours % 12 || 12}:${minutesText} ${period}`;
}

function toOpportunity(row: Tables<"opportunities">): Opportunity {
  const deadlineDate = row.deadline ? new Date(`${row.deadline}T00:00:00Z`) : null;
  const day = deadlineDate ? String(deadlineDate.getUTCDate()).padStart(2, "0") : "";
  const month = deadlineDate ? new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" }).format(deadlineDate).toUpperCase() : "";
  const longDate = deadlineDate ? new Intl.DateTimeFormat("en-US", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" }).format(deadlineDate) : "Not specified";
  const samplePrefix = row.is_sample ? "SAMPLE · " : "";
  const applyBy = day && month ? ` · APPLY BY ${day} ${month}` : "";

  return {
    label: `${samplePrefix}${row.category.toUpperCase()}${applyBy}`,
    title: row.title,
    detail: row.description,
    action: row.action_label,
    actionHref: row.application_url ?? "/opportunities",
    actionLabel: row.action_label,
    category: row.category,
    organization: row.organization,
    deadlineDay: day,
    deadlineMonth: month,
    deadline: longDate,
    eligibility: row.eligibility ?? "Not specified",
    location: [row.mode, row.location].filter(Boolean).join(" · ") || "Not specified",
    isSample: row.is_sample,
  };
}

export const getPublishedArticles = cache(async (): Promise<Story[]> => {
  const supabase = createSupabaseServerClient();
  if (!supabase) return [];

  try {
    const { data, error } = await supabase.from("articles").select(articleColumns)
      .eq("status", "published")
      .not("owner_profile_id", "is", null).eq("section.is_active", true)
      .order("sort_order", { ascending: true });
    if (error) { reportQueryError("articles", error); return []; }
    return toStories(data);
  } catch (error) {
    reportQueryError("articles", { message: error instanceof Error ? error.message : "unexpected database error" });
    return [];
  }
});

export const getFeaturedArticles = cache(async (limit = 4): Promise<Story[]> => {
  const supabase = createSupabaseServerClient();
  if (!supabase) return [];

  try {
    const { data, error } = await supabase.from("articles").select(articleColumns)
      .eq("status", "published").eq("is_featured", true)
      .not("owner_profile_id", "is", null).eq("section.is_active", true)
      .order("sort_order", { ascending: true }).limit(limit);
    if (error) { reportQueryError("featured articles", error); return []; }
    return toStories(data);
  } catch (error) {
    reportQueryError("featured articles", { message: error instanceof Error ? error.message : "unexpected database error" });
    return [];
  }
});

export const getArticleBySlug = cache(async (slug: string): Promise<Story | null> => {
  const supabase = createSupabaseServerClient();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase.from("articles").select(articleColumns)
      .eq("slug", slug).eq("status", "published")
      .not("owner_profile_id", "is", null).eq("section.is_active", true).maybeSingle();
    if (error) { reportQueryError(`article ${slug}`, error); return null; }
    return data ? (await toStories([data]))[0] ?? null : null;
  } catch (error) {
    reportQueryError(`article ${slug}`, { message: error instanceof Error ? error.message : "unexpected database error" });
    return null;
  }
});

export const getArticlesForSection = cache(async (slug: string): Promise<Story[]> => {
  const supabase = createSupabaseServerClient();
  if (!supabase) return [];

  try {
    const { data, error } = await supabase.from("articles").select(articleColumns)
      .eq("status", "published").eq("section.slug", slug)
      .not("owner_profile_id", "is", null).eq("section.is_active", true)
      .order("sort_order", { ascending: true });
    if (error) { reportQueryError(`articles for ${slug}`, error); return []; }
    return toStories(data);
  } catch (error) {
    reportQueryError(`articles for ${slug}`, { message: error instanceof Error ? error.message : "unexpected database error" });
    return [];
  }
});

export const getArticlesByProfile = cache(async (slug: string): Promise<Story[]> => {
  try {
    const profile = await getPublicProfile(slug);
    if (!profile) return [];
    const supabase = createSupabaseServerClient();
    if (!supabase) return [];
    const { data, error } = await supabase.from("articles").select(articleColumns)
      .eq("status", "published").eq("owner_profile_id", profile.id).eq("section.is_active", true)
      .order("sort_order", { ascending: true });
    if (error) { reportQueryError(`articles by ${slug}`, error); return []; }
    return toStories(data);
  } catch (error) {
    reportQueryError(`articles by ${slug}`, { message: error instanceof Error ? error.message : "unexpected database error" });
    return [];
  }
});

export const getProfileBySlug = cache(async (slug: string): Promise<ContributorProfile | null> => {
  try {
    const data = await getPublicProfile(slug);
    return data ? toContributorProfile(data) : null;
  } catch (error) {
    reportQueryError(`profile ${slug}`, { message: error instanceof Error ? error.message : "unexpected database error" });
    return null;
  }
});

export const getPublicProfiles = cache(async (): Promise<ContributorProfile[]> => {
  const supabase = createSupabaseServerClient();
  if (!supabase) return [];

  try {
    const { data, error } = await supabase.from("public_profiles").select("id,slug,display_name,role_title,bio,avatar_url,seo_description").order("display_name");
    if (error) { reportQueryError("public profiles", error); return []; }
    return data.map(toContributorProfile);
  } catch (error) {
    reportQueryError("public profiles", { message: error instanceof Error ? error.message : "unexpected database error" });
    return [];
  }
});

export const getSections = cache(async (): Promise<Section[]> => {
  const supabase = createSupabaseServerClient();
  if (!supabase) return [];

  try {
    const { data, error } = await supabase.from("sections").select("id,slug,name").eq("is_active", true).order("sort_order");
    if (error) { reportQueryError("sections", error); return []; }
    return data;
  } catch (error) {
    reportQueryError("sections", { message: error instanceof Error ? error.message : "unexpected database error" });
    return [];
  }
});

export const getEvents = cache(async (): Promise<Event[]> => {
  const supabase = createSupabaseServerClient();
  if (!supabase) return [];

  try {
    const { data, error } = await supabase.from("events").select("*").eq("status", "published").order("event_date").order("start_time");
    if (error) { reportQueryError("events", error); return []; }
    return data.map(toEvent);
  } catch (error) {
    reportQueryError("events", { message: error instanceof Error ? error.message : "unexpected database error" });
    return [];
  }
});

export const getOpportunities = cache(async (): Promise<Opportunity[]> => {
  const supabase = createSupabaseServerClient();
  if (!supabase) return [];

  try {
    const { data, error } = await supabase.from("opportunities").select("*").eq("status", "published").order("deadline", { ascending: true, nullsFirst: false });
    if (error) { reportQueryError("opportunities", error); return []; }
    return data.map(toOpportunity);
  } catch (error) {
    reportQueryError("opportunities", { message: error instanceof Error ? error.message : "unexpected database error" });
    return [];
  }
});
