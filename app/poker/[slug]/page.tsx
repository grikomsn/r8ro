import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import PokerSessionClient from "./PokerSessionClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;

  const supabase = await createClient();
  const { data: session } = await supabase
    .from("poker_sessions")
    .select("title")
    .eq("slug", slug)
    .single();

  const title =
    session?.title ||
    slug
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");

  return {
    title: `${title} - Poker Session`,
    description: `Join the "${title}" planning poker session on r8ro. Collaborate in real-time with your team on story estimation.`,
    robots: {
      index: false,
      follow: false,
      googleBot: {
        index: false,
        follow: false,
      },
    },
    openGraph: {
      title: `${title} - r8ro Poker Session`,
      description: `Join the "${title}" planning poker session. Collaborate in real-time with your team.`,
      type: "website",
      siteName: "r8ro",
      images: [
        {
          url: "/opengraph.png",
          width: 1200,
          height: 630,
          alt: "r8ro - Real-time Collaborative Planning Poker",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} - r8ro Poker Session`,
      description: `Join the "${title}" planning poker session on r8ro.`,
      images: ["/opengraph.png"],
    },
  };
}

export default function PokerSessionPage() {
  return <PokerSessionClient />;
}
