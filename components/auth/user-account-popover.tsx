"use client";

import { Code, ShieldCheck, User, UserCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useAuth } from "@/hooks/use-auth";

interface UserAccountPopoverProps {
  variant?: "default" | "compact";
}

export function UserAccountPopover({
  variant = "default",
}: UserAccountPopoverProps) {
  const { userId, displayName, isAnonymous, linkGitHubIdentity, isLoading } =
    useAuth();

  const handleLinkGitHub = async () => {
    const result = await linkGitHubIdentity();
    if (!result.success) {
      console.error(`Failed to link GitHub: ${result.error}`);
    }
  };

  if (!userId) {
    return null;
  }

  const isCompact = variant === "compact";
  const toneClasses = isAnonymous
    ? {
        avatar: "bg-primary/20",
        dot: "bg-primary",
        icon: "text-primary",
        label: "text-foreground",
        trigger:
          "border-primary/50 bg-primary/10 hover:border-primary hover:bg-primary/20",
      }
    : {
        avatar: "bg-chart-4/50",
        dot: "bg-chart-3",
        icon: "text-chart-3",
        label: "text-foreground",
        trigger:
          "border-chart-3/40 bg-chart-4/25 hover:border-chart-3 hover:bg-chart-4/40",
      };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          aria-label="User account menu"
          className={`group flex items-center gap-2 rounded-full border-2 transition-[border-color,background-color,box-shadow] hover:shadow-md ${toneClasses.trigger} ${isCompact ? "py-1 pr-2.5 pl-1" : "py-1.5 pr-3 pl-1.5"}`}
          type="button"
        >
          {/* Avatar circle with status indicator */}
          <div className="relative">
            <div
              className={`flex items-center justify-center rounded-full ${toneClasses.avatar} ${isCompact ? "h-6 w-6" : "h-7 w-7"}`}
            >
              {isAnonymous ? (
                <UserCircle
                  className={`${toneClasses.icon} ${isCompact ? "h-4 w-4" : "h-5 w-5"}`}
                />
              ) : (
                <Code
                  className={`${toneClasses.icon} ${isCompact ? "h-3.5 w-3.5" : "h-4 w-4"}`}
                />
              )}
            </div>
            {/* Status dot */}
            <div
              className={`absolute -right-0.5 -bottom-0.5 rounded-full border-2 border-background ${toneClasses.dot} ${isCompact ? "h-2.5 w-2.5" : "h-3 w-3"}`}
            />
          </div>

          {/* Display name or anonymous label */}
          <span
            className={`max-w-[100px] truncate font-semibold ${toneClasses.label} ${isCompact ? "text-xs" : "text-sm"}`}
          >
            {displayName || (isAnonymous ? "Guest" : "User")}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 rounded-xl p-0">
        <div className="rounded-t-xl border-border border-b-2 bg-muted px-4 py-3">
          <div className="flex items-center gap-2">
            <User
              aria-hidden="true"
              className="h-5 w-5 text-muted-foreground"
            />
            <h3 className="font-bold text-base uppercase">Account</h3>
          </div>
        </div>

        <div className="space-y-4 p-4">
          {/* User Info */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-muted-foreground text-xs uppercase">
                Display Name
              </span>
              <span className="font-semibold text-sm">
                {displayName || "Not set"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-bold text-muted-foreground text-xs uppercase">
                User ID
              </span>
              <code className="font-mono font-semibold text-xs">
                {userId.slice(0, 8)}…
              </code>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-bold text-muted-foreground text-xs uppercase">
                Status
              </span>
              <div className="flex items-center gap-1.5">
                {isAnonymous ? (
                  <>
                    <div className="h-2 w-2 rounded-full bg-primary" />
                    <span className="font-semibold text-primary text-xs">
                      Anonymous
                    </span>
                  </>
                ) : (
                  <>
                    <ShieldCheck
                      aria-hidden="true"
                      className="h-3.5 w-3.5 text-chart-3"
                    />
                    <span className="font-semibold text-chart-3 text-xs">
                      Linked
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Upgrade Section */}
          {isAnonymous && (
            <>
              <div className="h-px bg-border" />
              <div className="space-y-3">
                <div className="rounded-xl bg-muted p-3">
                  <p className="font-medium text-muted-foreground text-xs">
                    <strong className="text-foreground">
                      Upgrade your account
                    </strong>{" "}
                    to keep your data permanently and access it from any device.
                  </p>
                </div>
                <Button
                  className="w-full rounded-xl"
                  disabled={isLoading}
                  onClick={handleLinkGitHub}
                  size="lg"
                >
                  <Code aria-hidden="true" className="mr-2 h-4 w-4" />
                  Link GitHub Account
                </Button>
                <p className="text-center text-[10px] text-muted-foreground">
                  Your current user ID and all data will be preserved after
                  linking.
                </p>
              </div>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
