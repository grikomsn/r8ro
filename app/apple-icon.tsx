import { ImageResponse } from "next/og";
import { loadOgFonts, OG_COLORS } from "@/lib/og/render";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// iOS rounds the corners itself, so the icon is a full-bleed amber square
// with the "8" from the wordmark.
export default async function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        height: "100%",
        backgroundColor: OG_COLORS.primary,
        color: OG_COLORS.foreground,
        fontFamily: "Space Mono",
        fontSize: 132,
        fontWeight: 700,
        lineHeight: 1,
      }}
    >
      8
    </div>,
    { ...size, fonts: await loadOgFonts() }
  );
}
