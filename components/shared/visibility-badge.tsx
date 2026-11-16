"use client";

import { Globe, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

interface VisibilityBadgeProps {
  isPublic: boolean;
}

export function VisibilityBadge({ isPublic }: VisibilityBadgeProps) {
  const Icon = isPublic ? Globe : Lock;
  return (
    <span
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border-2 px-2.5 font-bold text-xs",
        isPublic
          ? "border-border text-muted-foreground"
          : "border-primary bg-primary/15 text-foreground"
      )}
      title={
        isPublic
          ? "Public: anyone with the link can join"
          : "Private: only people already here can open it"
      }
    >
      <Icon aria-hidden="true" className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">
        {isPublic ? "Public" : "Private"}
      </span>
      <span className="sr-only sm:hidden">
        {isPublic ? "Public" : "Private"}
      </span>
    </span>
  );
}
