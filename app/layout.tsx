import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://universityavenue.in"),
  title: { default: "University Avenue — Independent university journalism", template: "%s | University Avenue" },
  description: "An independent journal of university life, ideas and people. Starting at Shiv Nadar University.",
  openGraph: { type: "website", siteName: "University Avenue", title: "University Avenue", description: "An independent journal of university life, ideas and people." },
  twitter: { card: "summary_large_image", title: "University Avenue", description: "An independent journal of university life, ideas and people." },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
