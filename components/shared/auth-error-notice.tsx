"use client";

import { Button } from "@/components/ui/button";

interface AuthErrorNoticeProps {
  message: string;
}

/**
 * Shown when the session could not be verified. Without this the app shows a
 * loading spinner forever, which is the most common symptom of the backing
 * service being unavailable.
 */
export function AuthErrorNotice({ message }: AuthErrorNoticeProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary px-4">
      <div
        className="max-w-md rounded-2xl border-2 border-border bg-background p-8 shadow-md"
        role="alert"
      >
        <p className="font-bold text-primary text-xl">Session unavailable</p>
        <p className="mt-2 text-muted-foreground text-sm">{message}</p>
        <Button className="mt-6" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    </div>
  );
}
