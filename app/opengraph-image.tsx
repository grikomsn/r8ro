import {
  ColumnPanel,
  OG_COLORS,
  OG_CONTENT_TYPE,
  OG_SIZE,
  OgFrame,
  renderOgImage,
} from "@/lib/og/render";
import { RETRO_LANDING } from "@/lib/site";

export const alt = "r8ro: free realtime retrospective boards";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return renderOgImage(
    <OgFrame
      eyebrow="Free retrospectives · No sign-up"
      subtitle="Cards, votes, a shared timer and action items, live for everyone."
      title={RETRO_LANDING.heading}
    >
      <div style={{ display: "flex", width: "100%", gap: 20 }}>
        <ColumnPanel color={OG_COLORS.success} label="Went well" />
        <ColumnPanel color={OG_COLORS.mauve} label="To improve" />
        <ColumnPanel color={OG_COLORS.periwinkle} label="Action items" />
      </div>
    </OgFrame>
  );
}
