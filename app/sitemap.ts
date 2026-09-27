import type { MetadataRoute } from "next";
import { getPublishedArticles } from "./lib/data";

const base="https://universityavenue.in";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const articles = await getPublishedArticles();
  const pages = ["", "snu", "people", "ideas", "events", "opportunities", "about", "authors/dhrithi-shashibushan"];
  return [
    ...pages.map(path => ({ url: `${base}/${path}`, lastModified: new Date("2026-09-23"), changeFrequency: path === "" ? "daily" as const : "weekly" as const, priority: path === "" ? 1 : 0.7 })),
    ...articles.map(article => ({ url: `${base}/stories/${article.slug}`, lastModified: new Date(article.date), changeFrequency: "weekly" as const, priority: 0.7 })),
  ];
}
