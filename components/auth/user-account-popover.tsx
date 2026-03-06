"use client";

import { Github, ShieldCheck, User, UserCircle } from "lucide-react";
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

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          aria-label="User account menu"
          className={`group flex items-center gap-2 rounded-full border-2 transition-[border-color,background-color,box-shadow] hover:shadow-md ${
            isAnonymous
              ? "border-amber-400 bg-amber-50 hover:border-amber-500 hover:bg-amber-100"
              : "border-green-400 bg-green-50 hover:border-green-500 hover:bg-green-100"
          } ${isCompact ? "py-1 pr-2.5 pl-1" : "py-1.5 pr-3 pl-1.5"}`}
          type="button"
        >
          {/* Avatar circle with status indicator */}
          <div className="relative">
            <div
              className={`flex items-center justify-center rounded-full ${
                isAnonymous ? "bg-amber-200" : "bg-green-200"
              } ${isCompact ? "h-6 w-6" : "h-7 w-7"}`}
            >
              {isAnonymous ? (
                <UserCircle
                  className={`text-amber-700 ${isCompact ? "h-4 w-4" : "h-5 w-5"}`}
                />
              ) : (
                <Github
                  className={`text-green-700 ${isCompact ? "h-3.5 w-3.5" : "h-4 w-4"}`}
                />
              )}
            </div>
            {/* Status dot */}
            <div
              className={`absolute -right-0.5 -bottom-0.5 rounded-full border-2 border-white ${
                isAnonymous ? "bg-amber-500" : "bg-green-500"
              } ${isCompact ? "h-2.5 w-2.5" : "h-3 w-3"}`}
            />
          </div>

          {/* Display name or anonymous label */}
          <span
            className={`max-w-[100px] truncate font-semibold ${
              isAnonymous ? "text-amber-800" : "text-green-800"
            } ${isCompact ? "text-xs" : "text-sm"}`}
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
                    <div className="h-2 w-2 rounded-full bg-amber-500" />
                    <span className="font-semibold text-amber-600 text-xs">
                      Anonymous
                    </span>
                  </>
                ) : (
                  <>
                    <ShieldCheck
                      aria-hidden="true"
                      className="h-3.5 w-3.5 text-green-600"
                    />
                    <span className="font-semibold text-green-600 text-xs">
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
                  <Github aria-hidden="true" className="mr-2 h-4 w-4" />
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
