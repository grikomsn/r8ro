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

export default function Page() {
  return <RetroClientPage />;
}
