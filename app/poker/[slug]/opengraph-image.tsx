import {
  NON_ESTIMATE_VALUES,
  VOTING_SCALES,
} from "@/lib/constants/poker-scales";
import {
  clampText,
  OG_CONTENT_TYPE,
  OG_SIZE,
  OgFrame,
  PokerCard,
  plural,
  renderOgImage,
} from "@/lib/og/render";
import { OG_IMAGE_CACHE_CONTROL } from "@/lib/session-metadata";
import { getPublicSessionPreview } from "@/lib/session-preview";

export const alt = "r8ro planning poker session";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

const MAX_CARDS = 9;

/** The scale's estimate values, plus "?", trimmed to fit one row. */
function cardsFor(scale: string[] | null) {
  const values = (scale?.length ? scale : [...VOTING_SCALES.fibonacci])
    .filter((value) => value === "?" || !NON_ESTIMATE_VALUES.has(value))
    .map((value) => clampText(value, 4));
  return values.length > MAX_CARDS
    ? [...values.slice(0, MAX_CARDS - 1), values.at(-1) ?? "?"]
    : values;
}

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  // Public sessions only: the image is cached and shown to whoever sees the
  // link, so it must never depend on the requester's session.
  const preview = await getPublicSessionPreview("poker", slug);
  const cards = cardsFor(preview?.voting_scale ?? null);
  const highlighted = Math.floor((cards.length - 1) / 2);

  const subtitle = preview
    ? [
        preview.host_name && `Hosted by ${clampText(preview.host_name, 32)}`,
        `${preview.participant_count} ${plural(preview.participant_count, "participant")}`,
        preview.round_count
          ? `${preview.round_count} ${plural(preview.round_count, "story", "stories")} estimated`
          : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : "Open the link to join your team on r8ro.";

  return renderOgImage(
    <OgFrame
      eyebrow={preview ? "Planning poker · Live" : "Planning poker"}
      subtitle={subtitle}
      title={
        preview
          ? clampText(preview.title, 80)
          : "You're invited to planning poker"
      }
    >
      <div
        style={{
          display: "flex",
          width: "100%",
          justifyContent: cards.length > 6 ? "space-between" : "flex-start",
          gap: 20,
        }}
      >
        {cards.map((value, index) => (
          <PokerCard
            highlighted={index === highlighted}
            key={`${value}-${index}`}
            value={value}
          />
        ))}
      </div>
    </OgFrame>,
    { headers: { "Cache-Control": OG_IMAGE_CACHE_CONTROL } }
  );
}
