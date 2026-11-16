import type { Metadata } from "next";
import PokerClientPage from "./client-page";

export const metadata: Metadata = {
  title: "Planning poker",
  description:
    "Create planning poker sessions with realtime voting, presence, and vote reveal.",
  openGraph: {
    title: "r8ro planning poker",
    description:
      "Realtime planning poker with configurable scales and vote reveal.",
    type: "website",
    url: "https://r8ro.app/poker",
    images: [
      {
        url: "/opengraph.png",
        width: 1200,
        height: 630,
        alt: "r8ro planning poker",
      },
    ],
  },
};

const jsonLd = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "r8ro",
  description:
    "Realtime planning poker with hidden votes, reveal, statistics and round history.",
  url: "https://r8ro.app/poker",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  featureList: [
    "Votes hidden until reveal",
    "Fibonacci, T-shirt, and linear scales",
    "Consensus and suggested estimate",
    "Round history with Markdown export",
  ],
  browserRequirements: "Requires JavaScript. Requires HTML5.",
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
