import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Only the two landing pages are public; every other page is a private
// session, an account page or an organization page.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL, changeFrequency: "monthly", priority: 1 },
    { url: `${SITE_URL}/poker`, changeFrequency: "monthly", priority: 0.9 },
  ];
}
