import Link from "next/link";
import type React from "react";
import { AppLogo } from "@/components/shared/app-logo";
import { Button } from "@/components/ui/button";

export function FullPageLoading({ label = "Loading…" }: { label?: string }) {
  return (
    <div
      aria-busy="true"
      className="flex min-h-dvh items-center justify-center bg-canvas p-4"
    >
      <div className="flex items-center gap-3 rounded-2xl border-2 border-border bg-background px-6 py-5 shadow-md">
        <div
          aria-hidden="true"
          className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent"
        />
        <p className="font-bold text-lg" role="status">
          {label}
        </p>
      </div>
    </div>
  );
}

interface FullPageMessageProps {
  description?: string;
  homeHref: string;
  homeLabel?: string;
  icon?: React.ReactNode;
  /** Replaces the home link as the main action, which then becomes secondary. */
  primary?: React.ReactNode;
  title: string;
}

export function FullPageMessage({
  title,
  description,
  homeHref,
  homeLabel = "Back to home",
  icon,
  primary,
}: FullPageMessageProps) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-canvas p-4">
      <AppLogo />
      <div
        className="w-full max-w-md rounded-2xl border-2 border-border bg-background p-6 shadow-md md:p-8"
        role="alert"
      >
        {icon && (
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
            {icon}
          </div>
        )}
        <h1 className="font-black text-2xl">{title}</h1>
        {description && (
          <p className="mt-2 text-muted-foreground">{description}</p>
        )}
        <div className="mt-6 flex flex-wrap gap-2">
          {primary}
          <Button
            asChild
            className="rounded-lg font-bold"
            variant={primary ? "outline" : "default"}
          >
            <Link href={homeHref}>{homeLabel}</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
