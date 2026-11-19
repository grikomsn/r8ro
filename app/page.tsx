import type { Metadata } from "next";
import { RETRO_LANDING, SITE_NAME, SITE_URL } from "@/lib/site";
import { landingJsonLd } from "@/lib/structured-data";
import RetroClientPage from "./client-page";

const title = `${RETRO_LANDING.title} | ${SITE_NAME}`;

export const metadata: Metadata = {
  // The root layout's title template only applies to nested segments.
  title: { absolute: title },
  description: RETRO_LANDING.description,
  alternates: { canonical: SITE_URL },
  openGraph: {
    title,
    description: RETRO_LANDING.description,
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: SITE_NAME,
  },
  twitter: {
    card: "summary_large_image",
    title,
    description: RETRO_LANDING.description,
  },
};

const jsonLd = landingJsonLd({
  name: `${SITE_NAME} retrospective board`,
  description: RETRO_LANDING.description,
  path: "",
  featureList: [
    "Realtime cards and votes",
    "Participant presence",
    "Shared timer with pause and resume",
    "Public, private, and locked boards",
    "Markdown and image export",
  ],
});

export default function Page() {
  return (
    <>
      <script
        dangerouslySetInnerHTML={{ __html: jsonLd }}
        type="application/ld+json"
      />
      <RetroClientPage />
    </>
  );
}
