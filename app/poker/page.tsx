import type { Metadata } from "next";
import { POKER_LANDING, SITE_NAME, SITE_URL } from "@/lib/site";
import { landingJsonLd } from "@/lib/structured-data";
import PokerClientPage from "./client-page";

const url = `${SITE_URL}/poker`;

export const metadata: Metadata = {
  title: POKER_LANDING.title,
  description: POKER_LANDING.description,
  alternates: { canonical: url },
  openGraph: {
    title: `${POKER_LANDING.title} | ${SITE_NAME}`,
    description: POKER_LANDING.description,
    type: "website",
    locale: "en_US",
    url,
    siteName: SITE_NAME,
  },
  twitter: {
    card: "summary_large_image",
    title: `${POKER_LANDING.title} | ${SITE_NAME}`,
    description: POKER_LANDING.description,
  },
};

const jsonLd = landingJsonLd({
  name: `${SITE_NAME} planning poker`,
  description: POKER_LANDING.description,
  path: "/poker",
  featureList: [
    "Votes hidden until reveal",
    "Fibonacci, T-shirt, and linear scales",
    "Consensus and suggested estimate",
    "Round history with Markdown export",
  ],
});

export default function PokerPage() {
  return (
    <>
      <script
        dangerouslySetInnerHTML={{ __html: jsonLd }}
        type="application/ld+json"
      />
      <PokerClientPage />
    </>
  );
}
