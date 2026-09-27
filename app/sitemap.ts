import type { MetadataRoute } from "next";
import { getPublicProfiles, getPublishedArticles } from "./lib/data";

const base="https://universityavenue.in";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [articles, profiles] = await Promise.all([getPublishedArticles(), getPublicProfiles()]);
  const pages = ["", "snu", "people", "ideas", "events", "opportunities", "about", "authors/dhrithi-shashibushan"];
  return [
    ...pages.map(path => ({ url: `${base}/${path}`, lastModified: new Date("2026-09-23"), changeFrequency: path === "" ? "daily" as const : "weekly" as const, priority: path === "" ? 1 : 0.7 })),
    ...profiles.filter(profile => profile.slug !== "dhrithi-shashibushan").map(profile => ({ url: `${base}/authors/${profile.slug}`, lastModified: new Date("2026-09-23"), changeFrequency: "weekly" as const, priority: 0.6 })),
    ...articles.map(article => ({ url: `${base}/stories/${article.slug}`, lastModified: new Date(article.date), changeFrequency: "weekly" as const, priority: 0.7 })),
  ];
}
