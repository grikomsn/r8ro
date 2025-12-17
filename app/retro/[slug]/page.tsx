import type { Metadata } from "next"
import RetroPageClient from "./RetroPageClient"

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params

  const formattedTitle = slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")

  return {
    title: `${formattedTitle} - Retro Session`,
    description: `Join the "${formattedTitle}" retrospective session on r8ro. Collaborate in real-time with your team on sprint retrospectives and action items.`,
    robots: {
      index: false,
      follow: false,
      googleBot: {
        index: false,
        follow: false,
      },
    },
    openGraph: {
      title: `${formattedTitle} - r8ro Retro Session`,
      description: `Join the "${formattedTitle}" retrospective session. Collaborate in real-time with your team.`,
      type: "website",
      siteName: "r8ro",
      images: [
        {
          url: "/opengraph.png",
          width: 1200,
          height: 630,
          alt: "r8ro - Real-time Collaborative Retrospectives",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${formattedTitle} - r8ro Retro Session`,
      description: `Join the "${formattedTitle}" retrospective session on r8ro.`,
      images: ["/opengraph.png"],
    },
  }
}

export default function RetroPage() {
  return <RetroPageClient />
}
