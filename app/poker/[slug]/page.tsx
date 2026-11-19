import type { Metadata } from "next";
import { buildSessionMetadata } from "@/lib/session-metadata";
import PokerSessionClient from "./PokerSessionClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return buildSessionMetadata("poker", slug);
}

export default function PokerSessionPage() {
  return <PokerSessionClient />;
}
