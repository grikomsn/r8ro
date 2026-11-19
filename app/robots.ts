import type { MetadataRoute } from "next";
import { isIndexableDeployment, SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  if (!isIndexableDeployment()) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }

  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/poker"],
      // Sessions and accounts are private; their pages also send noindex.
      // "/poker/" (with the slash) matches sessions but not the landing page.
      disallow: ["/retro/", "/poker/", "/new", "/account", "/orgs", "/auth/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
