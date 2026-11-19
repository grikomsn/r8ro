"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

// Wayfindr's flat accents and tints of them, all readable with navy ink.
const COLORS = [
  "#efba5a",
  "#b8d8e4",
  "#b1ceb3",
  "#a6b6f1",
  "#f6d4fb",
  "#e2bfdf",
  "#9fcbb8",
  "#f5d48f",
];
const WORD_SEPARATOR = /[\s_-]+/;
const CAPITAL = /[A-Z]/g;

function hashName(name: string) {
  let hash = 0;
  for (const char of name) {
    hash = (hash * 31 + char.charCodeAt(0)) % 2_147_483_647;
  }
  return hash;
}

export function initialsOf(name: string) {
  const parts = name.trim().split(WORD_SEPARATOR).filter(Boolean);
  if (parts.length === 0) {
    return "?";
  }
  if (parts.length === 1) {
    // Split camel case such as "HappyPanda" into "HP".
    const capitals = parts[0].match(CAPITAL);
    if (capitals && capitals.length >= 2) {
      return `${capitals[0]}${capitals[1]}`;
    }
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0]}${parts.at(-1)?.[0] ?? ""}`.toUpperCase();
}

interface AvatarProps {
  className?: string;
  name: string;
  online?: boolean;
  size?: "sm" | "md" | "lg";
  /** Photo, such as a GitHub avatar. Initials show when it fails to load. */
  src?: string | null;
}

const SIZE_CLASSES = {
  sm: "h-7 w-7 text-[11px]",
  md: "h-8 w-8 text-xs",
  lg: "h-16 w-16 text-xl",
} as const;

export function Avatar({
  className,
  name,
  online,
  size = "md",
  src,
}: AvatarProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const color = COLORS[hashName(name) % COLORS.length];
  const showImage = !!src && failedSrc !== src;
  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative inline-flex shrink-0 select-none items-center justify-center rounded-full font-bold text-ink ring-2 ring-background",
        SIZE_CLASSES[size],
        className
      )}
      style={{ backgroundColor: color }}
    >
      {showImage ? (
        // biome-ignore lint/performance/noImgElement: a remote avatar in a fixed circle needs no image optimisation, and images are unoptimized
        <img
          alt=""
          className="h-full w-full rounded-full object-cover"
          height={64}
          onError={() => setFailedSrc(src)}
          referrerPolicy="no-referrer"
          src={src}
          width={64}
        />
      ) : (
        initialsOf(name)
      )}
      {online !== undefined && (
        <span
          className={cn(
            "absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border-2 border-background",
            online ? "bg-success" : "bg-muted-foreground/60"
          )}
        />
      )}
    </span>
  );
}
