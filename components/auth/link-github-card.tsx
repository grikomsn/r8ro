"use client";

import { Code } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

interface LinkGitHubCardProps {
  body: React.ReactNode;
  className?: string;
  title: React.ReactNode;
}

/** Asks a guest to link GitHub, which keeps their sessions on any device. */
export function LinkGitHubCard({
  body,
  className,
  title,
}: LinkGitHubCardProps) {
  const { isAnonymous, isLoading, linkGitHubIdentity } = useAuth();
  const [isStarting, setIsStarting] = useState(false);

  const handleLink = async () => {
    setIsStarting(true);
    const result = await linkGitHubIdentity();
    if (!result.success) {
      setIsStarting(false);
      toast.error("Could not start GitHub linking", {
        description: result.error,
      });
    }
    // On success the browser leaves for GitHub, so the button stays busy.
  };

  return (
    <div className={cn("space-y-3 rounded-xl bg-muted p-4", className)}>
      <div className="space-y-1 text-sm">
        <p className="font-bold text-foreground">{title}</p>
        <div className="text-muted-foreground">{body}</div>
      </div>
      {!isAnonymous && (
        // Linking starts from a guest account. A registered account without
        // GitHub (created through the Auth API) has no way to add one here.
        <p className="text-muted-foreground text-sm">
          This account was not created with GitHub. Sign out and continue with
          GitHub to use this.
        </p>
      )}
      {isAnonymous && (
        <Button
          className="w-full rounded-lg font-bold sm:w-auto"
          disabled={isLoading || isStarting}
          onClick={handleLink}
        >
          <Code aria-hidden="true" className="mr-2 h-4 w-4" />
          {isStarting ? "Opening GitHub…" : "Continue with GitHub"}
        </Button>
      )}
    </div>
  );
}
