import type { Metadata } from "next";
import { buildSessionMetadata } from "@/lib/session-metadata";
import RetroPageClient from "./RetroPageClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return buildSessionMetadata("retro", slug);
}

export default function RetroPage() {
  return <RetroPageClient />;
}
