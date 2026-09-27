import Link from "next/link";

export function AdminNavigation({ active }: { active: "stories" | "events" | "opportunities" }) {
  return <nav aria-label="Administration" className="admin-navigation">
    <Link aria-current={active === "stories" ? "page" : undefined} href="/admin">Stories</Link>
    <Link aria-current={active === "events" ? "page" : undefined} href="/admin/events">Events</Link>
    <Link aria-current={active === "opportunities" ? "page" : undefined} href="/admin/opportunities">Opportunities</Link>
  </nav>;
}
