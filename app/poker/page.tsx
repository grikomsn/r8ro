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

export default function PokerPage() {
  return <PokerClientPage />;
}
