import type { Metadata } from "next";
import RetroClientPage from "./client-page";

export const metadata: Metadata = {
  title: "Realtime retrospective boards",
  description:
    "Create retrospective boards with realtime cards, voting, presence, and a shared timer.",
  openGraph: {
    title: "r8ro retrospective boards",
    description:
      "Realtime retrospective boards with cards, voting, presence, and a shared timer.",
    type: "website",
    url: "https://r8ro.app",
    images: [
      {
        url: "/opengraph.png",
        width: 1200,
        height: 630,
        alt: "r8ro retrospective board",
      },
    ],
  },
};

const jsonLd = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "r8ro",
  description:
    "Realtime retrospective boards with cards, voting, presence, a shared timer and Markdown export.",
  url: "https://r8ro.app",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  featureList: [
    "Realtime cards and votes",
    "Participant presence",
    "Shared timer with pause and resume",
    "Public, private, and locked boards",
    "Markdown and image export",
  ],
  browserRequirements: "Requires JavaScript. Requires HTML5.",
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
