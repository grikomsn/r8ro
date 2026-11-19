"use client";

import { Copy } from "lucide-react";
import { toast } from "sonner";
import { reportActionError } from "@/lib/utils/errors";

export function SessionCodeButton({ slug }: { slug: string }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(slug);
      toast.success("Session code copied", { description: slug });
    } catch (error) {
      reportActionError("Could not copy the code", error);
    }
  };

  return (
    <button
      aria-label={`Session code ${slug}. Click to copy`}
      className="group flex min-w-0 max-w-full items-center gap-1 rounded font-mono text-muted-foreground text-xs outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      onClick={copy}
      type="button"
    >
      <span className="truncate">{slug}</span>
      <Copy
        aria-hidden="true"
        className="h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
      />
    </button>
  );
}
