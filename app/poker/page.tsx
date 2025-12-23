import type { Metadata } from "next";
import PokerClientPage from "./client-page";

export const metadata: Metadata = {
  title: "Scrum Poker - r8ro",
  description:
    "Create and run planning poker sessions with your team. Real-time collaboration, voting, and estimation. Perfect for agile teams and sprint planning.",
  openGraph: {
    title: "Scrum Poker - r8ro",
    description:
      "Create and run planning poker sessions with your team. Real-time collaboration and voting.",
    type: "website",
    url: "https://r8ro.app/poker",
    images: [
      {
        url: "/opengraph.png",
        width: 1200,
        height: 630,
        alt: "r8ro - Real-time Collaborative Planning Poker",
      },
    ],
  },
};

export default function PokerPage() {
  return <PokerClientPage />;
}
