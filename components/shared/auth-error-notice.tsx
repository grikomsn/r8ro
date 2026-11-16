"use client";

import { WifiOff } from "lucide-react";
import { FullPageMessage } from "@/components/shared/full-page-status";
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
    <FullPageMessage
      description={message}
      homeHref="/"
      icon={<WifiOff aria-hidden="true" className="h-6 w-6" />}
      primary={
        <Button
          className="rounded-lg font-bold"
          onClick={() => window.location.reload()}
        >
          Try again
        </Button>
      }
      title="Could not connect"
    />
  );
}
