import Link from "next/link";
import type React from "react";
import { AppLogo } from "@/components/shared/app-logo";

interface SessionTopbarProps {
  /** Controls on the right, in priority order. */
  actions: React.ReactNode;
  homeHref: string;
  /** Short status line under the title. */
  meta: React.ReactNode;
  title: React.ReactNode;
}

/**
 * The one-row header of a retro board or poker session. It never wraps, so
 * on a phone the page keeps almost all of its height for content.
 */
export function SessionTopbar({
  actions,
  homeHref,
  meta,
  title,
}: SessionTopbarProps) {
  return (
    <header className="sticky top-0 z-30 border-border border-b-2 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
      <div className="flex h-14 items-center gap-2 px-2 sm:gap-3 sm:px-4">
        <AppLogo className="hidden sm:block" href={homeHref} />
        <Link
          aria-label="Home"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg font-black font-mono text-lg outline-none focus-visible:ring-2 focus-visible:ring-ring sm:hidden"
          href={homeHref}
        >
          R<span className="text-primary">8</span>
        </Link>
        <div className="min-w-0 flex-1 sm:border-border sm:border-l-2 sm:pl-3">
          {title}
          <div className="flex min-w-0 items-center gap-x-1.5 overflow-hidden whitespace-nowrap text-muted-foreground text-xs">
            {meta}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-0.5 sm:gap-1.5">
          {actions}
        </div>
      </div>
    </header>
  );
}
