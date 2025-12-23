import type { Metadata } from "next";
import RetroPageClient from "./RetroPageClient";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;

  const supabase = await createClient();
  const { data: board } = await supabase
    .from("retro_boards")
    .select("title")
    .eq("slug", slug)
    .single();

  const title =
    board?.title ||
    slug
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");

  return {
    title: `${title} - Retro Session`,
    description: `Join the "${title}" retrospective session on r8ro. Collaborate in real-time with your team on sprint retrospectives and action items.`,
    robots: {
      index: false,
      follow: false,
      googleBot: {
        index: false,
        follow: false,
      },
    },
    openGraph: {
      title: `${title} - r8ro Retro Session`,
      description: `Join the "${title}" retrospective session. Collaborate in real-time with your team.`,
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
      title: `${title} - r8ro Retro Session`,
      description: `Join the "${title}" retrospective session on r8ro.`,
      images: ["/opengraph.png"],
    },
  };
}

export default function RetroPage() {
  return <RetroPageClient />;
}
