import { SITE_NAME, SITE_URL } from "@/lib/site";

interface AppStructuredData {
  description: string;
  featureList: string[];
  name: string;
  path: string;
}

/**
 * JSON-LD for a landing page: the free web application, plus the WebSite
 * entity that gives search results the site name.
 */
export function landingJsonLd({
  description,
  featureList,
  name,
  path,
}: AppStructuredData) {
  const url = `${SITE_URL}${path}`;
  return JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        name: SITE_NAME,
        url: SITE_URL,
      },
      {
        "@type": "WebApplication",
        "@id": `${url}#app`,
        name,
        description,
        url,
        image: `${url}/opengraph-image`,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        browserRequirements: "Requires JavaScript. Requires HTML5.",
        isAccessibleForFree: true,
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        featureList,
        isPartOf: { "@id": `${SITE_URL}/#website` },
      },
    ],
  }).replace(/</g, "\\u003c");
}
