import { cache } from "react";
import { createPublicClient } from "@/lib/supabase/public";
import { createClient } from "@/lib/supabase/server";

export type SessionKind = "retro" | "poker";

/** Summary returned by public.get_session_preview; see its migration. */
export interface SessionPreview {
  action_item_count: number | null;
  host_name: string | null;
  is_locked: boolean;
  is_public: boolean;
  kind: SessionKind;
  participant_count: number;
  round_count: number | null;
  title: string;
  to_improve_count: number | null;
  voting_scale: string[] | null;
  went_well_count: number | null;
}

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SLUG_MAX_LENGTH = 100;

export function isValidSlug(slug: string) {
  return slug.length <= SLUG_MAX_LENGTH && SLUG_PATTERN.test(slug);
}

async function fetchPreview(
  kind: SessionKind,
  slug: string,
  viewer: "visitor" | "public"
): Promise<SessionPreview | null> {
  if (!isValidSlug(slug)) {
    return null;
  }

  const supabase =
    viewer === "visitor" ? await createClient() : createPublicClient();
  const { data, error } = await supabase
    .rpc("get_session_preview", { p_kind: kind, p_slug: slug })
    .maybeSingle<SessionPreview>();

  if (error) {
    console.error(`Failed to load ${kind} preview:`, error.message);
    return null;
  }
  return data;
}

/**
 * The preview as the current visitor may see it: public sessions for anyone,
 * and private ones the visitor can open. Used for the page's own metadata.
 */
export const getVisitorSessionPreview = cache(
  (kind: SessionKind, slug: string) => fetchPreview(kind, slug, "visitor")
);

/**
 * The preview as a signed-out visitor sees it: public sessions only. Used for
 * shareable, cacheable output such as the Open Graph image.
 */
export const getPublicSessionPreview = cache(
  (kind: SessionKind, slug: string) => fetchPreview(kind, slug, "public")
);
