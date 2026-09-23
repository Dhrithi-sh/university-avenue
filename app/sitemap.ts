import type { MetadataRoute } from "next";
import { stories } from "./lib/content";
const base="https://universityavenue.in";
export default function sitemap():MetadataRoute.Sitemap{return ["","snu","people","ideas","events","opportunities","about","authors/dhrithi-shashibushan",...stories.map(s=>`stories/${s.slug}`)].map(path=>({url:`${base}/${path}`,lastModified:new Date("2026-09-23"),changeFrequency:path===""?"daily":"weekly",priority:path===""?1:0.7}))}
