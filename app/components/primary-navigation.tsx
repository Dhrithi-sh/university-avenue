"use client";

import { useState } from "react";
import Link from "next/link";
import type { ProfileRole, ProfileStatus } from "../lib/database.types";

type NavigationProfile = { role: ProfileRole; status: ProfileStatus } | null;

export function PrimaryNavigation({ profile }: { profile: NavigationProfile }) {
  const [menuOpen, setMenuOpen] = useState(false);

  const activeProfile = profile?.status === "active" ? profile : null;
  const contributionHref = activeProfile ? "/contribute" : "/login?next=%2Fcontribute";

  return <><button className="menu-toggle" type="button" aria-expanded={menuOpen} aria-controls="primary-navigation" onClick={() => setMenuOpen(open => !open)}><span className="menu-icon" aria-hidden="true"><i/><i/></span><span>{menuOpen ? "Close" : "Menu"}</span></button><nav id="primary-navigation" className={menuOpen ? "is-open" : ""} aria-label="Main navigation"><Link onClick={() => setMenuOpen(false)} href="/snu">SNU</Link><Link onClick={() => setMenuOpen(false)} href="/people">People</Link><Link onClick={() => setMenuOpen(false)} href="/ideas">Editorial</Link><Link onClick={() => setMenuOpen(false)} href="/events">Events</Link><Link onClick={() => setMenuOpen(false)} href="/opportunities">Opportunities</Link><Link onClick={() => setMenuOpen(false)} href="/about">About</Link><Link className="nav-contribute" onClick={() => setMenuOpen(false)} href={contributionHref}>{activeProfile ? "My Stories" : "Contribute"}</Link>{activeProfile?.role === "admin" && <Link className="nav-admin" onClick={() => setMenuOpen(false)} href="/admin">Admin</Link>}</nav></>;
}
