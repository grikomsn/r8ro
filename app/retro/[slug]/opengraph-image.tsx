import {
  ColumnPanel,
  clampText,
  OG_COLORS,
  OG_CONTENT_TYPE,
  OG_SIZE,
  OgFrame,
  plural,
  renderOgImage,
} from "@/lib/og/render";
import { OG_IMAGE_CACHE_CONTROL } from "@/lib/session-metadata";
import { getPublicSessionPreview } from "@/lib/session-preview";

export const alt = "r8ro retro board";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  // Public sessions only: the image is cached and shown to whoever sees the
  // link, so it must never depend on the requester's session.
  const preview = await getPublicSessionPreview("retro", slug);

  const subtitle = preview
    ? [
        preview.host_name && `Hosted by ${clampText(preview.host_name, 32)}`,
        `${preview.participant_count} ${plural(preview.participant_count, "participant")}`,
      ]
        .filter(Boolean)
        .join(" · ")
    : "Open the link to join your team on r8ro.";

  return renderOgImage(
    <OgFrame
      eyebrow={
        preview
          ? `Retro board · ${preview.is_locked ? "Locked" : "Live"}`
          : "Retro board"
      }
      subtitle={subtitle}
      title={
        preview ? clampText(preview.title, 80) : "You're invited to a retro"
      }
    >
      <div style={{ display: "flex", width: "100%", gap: 20 }}>
        <ColumnPanel
          color={OG_COLORS.success}
          count={preview?.went_well_count}
          label="Went well"
        />
        <ColumnPanel
          color={OG_COLORS.mauve}
          count={preview?.to_improve_count}
          label="To improve"
        />
        <ColumnPanel
          color={OG_COLORS.periwinkle}
          count={preview?.action_item_count}
          label="Action items"
        />
      </div>
    </OgFrame>,
    { headers: { "Cache-Control": OG_IMAGE_CACHE_CONTROL } }
  );
}
