import type { Metadata } from "next"
import ClientPage from "./client-page"

export const metadata: Metadata = {
  title: "r8ro - Real-time Collaborative Retrospectives",
  description:
    "Create and run effective retrospective sessions with your team. Real-time collaboration, voting, timer controls, and privacy features. Perfect for agile teams and sprint retrospectives.",
  openGraph: {
    title: "r8ro - Real-time Collaborative Retrospectives",
    description:
      "Create and run effective retrospective sessions with your team. Real-time collaboration, voting, timer controls, and privacy features.",
    type: "website",
    url: "https://r8ro.app",
    images: [
      {
        url: "/opengraph.png",
        width: 1200,
        height: 630,
        alt: "r8ro - Real-time Collaborative Retrospectives",
      },
    ],
  },
}

export default function Page() {
  return <ClientPage />
}
