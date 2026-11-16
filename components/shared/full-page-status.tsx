import Link from "next/link";
import type React from "react";
import { Button } from "@/components/ui/button";

export function FullPageLoading({ label = "Loading…" }: { label?: string }) {
  return (
    <div
      aria-busy="true"
      className="flex min-h-dvh items-center justify-center bg-secondary p-4"
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
  children?: React.ReactNode;
  description?: string;
  homeHref: string;
  homeLabel?: string;
  title: string;
}

export function FullPageMessage({
  title,
  description,
  homeHref,
  homeLabel = "Back to home",
  children,
}: FullPageMessageProps) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-secondary p-4">
      <div
        className="w-full max-w-md rounded-2xl border-2 border-border bg-background p-6 shadow-md md:p-8"
        role="alert"
      >
        <h1 className="font-black text-2xl">{title}</h1>
        {description && (
          <p className="mt-2 text-muted-foreground">{description}</p>
        )}
        <div className="mt-6 flex flex-wrap gap-2">
          <Button asChild className="rounded-lg font-bold">
            <Link href={homeHref}>{homeLabel}</Link>
          </Button>
          {children}
        </div>
      </div>
    </div>
  );
}
