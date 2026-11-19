import type React from "react";
import { SiteHeader } from "@/components/shared/site-header";
import { cn } from "@/lib/utils";

interface PageShellProps {
  /** Buttons shown beside the title; they wrap under it on phones. */
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  description?: React.ReactNode;
  /** Small line above the title, such as a breadcrumb. */
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
}

/** The site header and a centred column, for account and organization pages. */
export function PageShell({
  actions,
  children,
  className,
  description,
  eyebrow,
  title,
}: PageShellProps) {
  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <SiteHeader />
      <main
        className={cn(
          "mx-auto w-full max-w-4xl flex-1 space-y-6 px-4 py-6 md:py-10",
          className
        )}
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0 space-y-1">
            {eyebrow && (
              <div className="font-bold text-muted-foreground text-sm">
                {eyebrow}
              </div>
            )}
            <h1 className="break-words font-black text-2xl leading-tight md:text-3xl">
              {title}
            </h1>
            {description && (
              <p className="max-w-prose text-muted-foreground">{description}</p>
            )}
          </div>
          {actions && (
            <div className="flex flex-wrap items-center gap-2">{actions}</div>
          )}
        </div>
        {children}
      </main>
    </div>
  );
}

/** A white panel on the grey page, the building block of these pages. */
export function Panel({
  children,
  className,
  title,
  description,
  actions,
  id,
}: {
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  description?: React.ReactNode;
  id?: string;
  title?: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby={title && id ? `${id}-title` : undefined}
      className={cn(
        "rounded-2xl border-2 border-border bg-background p-4 shadow-md md:p-6",
        className
      )}
    >
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            {title && (
              <h2
                className="font-black text-lg"
                id={id ? `${id}-title` : undefined}
              >
                {title}
              </h2>
            )}
            {description && (
              <p className="text-muted-foreground text-sm">{description}</p>
            )}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}
