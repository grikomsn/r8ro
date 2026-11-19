import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import type React from "react";

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

/**
 * Light-theme tokens from app/globals.css. Satori renders without the page's
 * stylesheet, so the values are repeated here; keep the two in step.
 */
export const OG_COLORS = {
  background: "#ffffff",
  foreground: "#101828",
  muted: "#f2f4f7",
  mutedForeground: "#475467",
  canvas: "#f2f4f7",
  border: "#eaecf0",
  input: "#d0d5dd",
  primary: "#efba5a",
  accent: "#fdf4d7",
  brandText: "#8f5a00",
  success: "#378264",
  mauve: "#a05f9a",
  periwinkle: "#a6b6f1",
  sky: "#b8d8e4",
  pink: "#f6d4fb",
  sage: "#b1ceb3",
} as const;

const FONT_DIR = join(process.cwd(), "lib/og/fonts");

let fontsPromise: Promise<
  { name: string; data: Buffer; weight: 700 | 900; style: "normal" }[]
> | null = null;

export function loadOgFonts() {
  fontsPromise ??= Promise.all([
    readFile(join(FONT_DIR, "Lato-Bold.ttf")),
    readFile(join(FONT_DIR, "Lato-Black.ttf")),
    readFile(join(FONT_DIR, "SpaceMono-Bold.ttf")),
  ]).then(([latoBold, latoBlack, spaceMono]) => [
    { name: "Lato", data: latoBold, weight: 700, style: "normal" },
    { name: "Lato", data: latoBlack, weight: 900, style: "normal" },
    { name: "Space Mono", data: spaceMono, weight: 700, style: "normal" },
  ]);
  return fontsPromise;
}

export async function renderOgImage(
  element: React.ReactElement,
  init?: { headers?: Record<string, string> }
) {
  return new ImageResponse(element, {
    ...OG_SIZE,
    fonts: await loadOgFonts(),
    headers: init?.headers,
  });
}

/** Trims user-supplied text so a long title cannot break the layout. */
export function clampText(text: string, max: number) {
  const trimmed = text.trim().replace(/\s+/g, " ");
  return trimmed.length > max
    ? `${trimmed.slice(0, max - 1).trimEnd()}…`
    : trimmed;
}

/** Large for short titles, smaller as they grow, so two lines always fit. */
export function titleFontSize(title: string) {
  if (title.length <= 18) {
    return 84;
  }
  if (title.length <= 32) {
    return 68;
  }
  if (title.length <= 52) {
    return 56;
  }
  return 46;
}

export function Logo({ accent = "#ffffff" }: { accent?: string }) {
  return (
    <div
      style={{
        display: "flex",
        fontFamily: "Space Mono",
        fontSize: 40,
        fontWeight: 700,
        letterSpacing: -1,
        color: OG_COLORS.foreground,
      }}
    >
      R<span style={{ color: accent }}>8</span>RO
    </div>
  );
}

interface FrameProps {
  /** Lower panel content, drawn on the grey canvas below the amber band. */
  children: React.ReactNode;
  eyebrow: string;
  subtitle?: string;
  title: string;
}

/**
 * The landing-page look: an amber hero band with a rounded bottom edge over
 * the grey canvas, the wordmark, an eyebrow and a heavy navy headline.
 */
export function OgFrame({ children, eyebrow, subtitle, title }: FrameProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        backgroundColor: OG_COLORS.canvas,
        fontFamily: "Lato",
        color: OG_COLORS.foreground,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          backgroundColor: OG_COLORS.primary,
          borderBottomLeftRadius: 64,
          borderBottomRightRadius: 64,
          padding: "44px 64px 48px",
          gap: 14,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Logo />
          <div
            style={{
              display: "flex",
              fontSize: 24,
              fontWeight: 700,
              color: OG_COLORS.foreground,
              opacity: 0.75,
            }}
          >
            r8ro.app
          </div>
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 18,
            fontSize: 24,
            fontWeight: 900,
            letterSpacing: 2,
            textTransform: "uppercase",
            opacity: 0.7,
          }}
        >
          {eyebrow}
        </div>
        <div
          style={{
            display: "block",
            fontSize: titleFontSize(title),
            fontWeight: 900,
            lineHeight: 1.08,
            letterSpacing: -1,
            lineClamp: 2,
          }}
        >
          {title}
        </div>
        {subtitle && (
          <div
            style={{
              display: "flex",
              fontSize: 28,
              fontWeight: 700,
              opacity: 0.8,
            }}
          >
            {subtitle}
          </div>
        )}
      </div>
      <div
        style={{
          display: "flex",
          flex: 1,
          alignItems: "center",
          padding: "0 64px",
        }}
      >
        {children}
      </div>
    </div>
  );
}

/** A white panel with a coloured chip, as on the board columns. */
export function ColumnPanel({
  color,
  count,
  label,
}: {
  color: string;
  count?: number | null;
  label: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        flex: 1,
        alignItems: "center",
        gap: 16,
        padding: "22px 26px",
        backgroundColor: OG_COLORS.background,
        border: `3px solid ${OG_COLORS.border}`,
        borderRadius: 24,
      }}
    >
      <div
        style={{
          display: "flex",
          width: 20,
          height: 20,
          borderRadius: 999,
          backgroundColor: color,
        }}
      />
      <div style={{ display: "flex", fontSize: 28, fontWeight: 900 }}>
        {label}
      </div>
      {typeof count === "number" && (
        <div
          style={{
            display: "flex",
            marginLeft: "auto",
            padding: "4px 16px",
            borderRadius: 999,
            backgroundColor: OG_COLORS.muted,
            fontFamily: "Space Mono",
            fontSize: 26,
            fontWeight: 700,
          }}
        >
          {count}
        </div>
      )}
    </div>
  );
}

/** A planning poker card face. */
export function PokerCard({
  highlighted = false,
  value,
}: {
  highlighted?: boolean;
  value: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 92,
        height: 128,
        borderRadius: 18,
        border: `3px solid ${highlighted ? OG_COLORS.foreground : OG_COLORS.border}`,
        backgroundColor: highlighted ? OG_COLORS.primary : OG_COLORS.background,
        fontFamily: "Space Mono",
        fontSize: value.length > 2 ? 30 : 42,
        fontWeight: 700,
        marginTop: highlighted ? -24 : 0,
      }}
    >
      {value}
    </div>
  );
}

/** Small "N participants" style statistic. */
export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        gap: 10,
        fontSize: 26,
        color: OG_COLORS.mutedForeground,
        fontWeight: 700,
      }}
    >
      <span
        style={{
          fontFamily: "Space Mono",
          fontSize: 30,
          color: OG_COLORS.foreground,
        }}
      >
        {value}
      </span>
      {label}
    </div>
  );
}

export function plural(count: number, one: string, many = `${one}s`) {
  return count === 1 ? one : many;
}
