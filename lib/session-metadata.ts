import type { Metadata } from "next";
import {
  getVisitorSessionPreview,
  type SessionKind,
} from "@/lib/session-preview";
import { SITE_NAME, SITE_URL } from "@/lib/site";

/**
 * Session previews change as people join and add cards, and a session can be
 * made private, so the image is cached briefly rather than forever.
 */
export const OG_IMAGE_CACHE_CONTROL =
  "public, max-age=300, s-maxage=300, stale-while-revalidate=600";

const COPY: Record<
  SessionKind,
  {
    label: string;
    noun: string;
    path: string;
    pitch: string;
  }
> = {
  retro: {
    label: "Retro board",
    noun: "retrospective",
    path: "/retro",
    pitch:
      "Add cards, vote on what matters and agree on action items together.",
  },
  poker: {
    label: "Planning poker",
    noun: "planning poker session",
    path: "/poker",
    pitch:
      "Vote in secret, reveal together and settle on an estimate for each story.",
  },
};

/**
 * Metadata for a retro board or poker session page. Sessions are never
 * indexed, but their links are shared constantly, so the title and
 * description are written for link previews.
 */
export async function buildSessionMetadata(
  kind: SessionKind,
  slug: string
): Promise<Metadata> {
  const copy = COPY[kind];
  const preview = await getVisitorSessionPreview(kind, slug);

  const title = preview ? `${preview.title} · ${copy.label}` : copy.label;
  const description = preview
    ? `Join “${preview.title}”${
        preview.host_name
          ? `, a ${copy.noun} hosted by ${preview.host_name}`
          : ""
      } on ${SITE_NAME}. ${copy.pitch}`
    : `You're invited to a ${copy.noun} on ${SITE_NAME}. ${copy.pitch}`;

  return {
    title,
    description,
    robots: {
      index: false,
      follow: false,
      googleBot: { index: false, follow: false },
    },
    openGraph: {
      title: preview ? preview.title : `${copy.label} on ${SITE_NAME}`,
      description,
      type: "website",
      siteName: SITE_NAME,
      url: `${SITE_URL}${copy.path}/${slug}`,
    },
    twitter: {
      card: "summary_large_image",
      title: preview ? preview.title : `${copy.label} on ${SITE_NAME}`,
      description,
    },
  };
}
