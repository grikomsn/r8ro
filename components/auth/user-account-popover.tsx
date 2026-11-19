"use client";

import {
  Building2,
  Check,
  Download,
  LayoutList,
  Pencil,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import Link from "next/link";
import type React from "react";
import { useState } from "react";
import { toast } from "sonner";
import { LinkGitHubCard } from "@/components/auth/link-github-card";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { Avatar } from "@/components/shared/avatar";
import { ThemeSwitcher } from "@/components/shared/theme-switcher";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useAuth } from "@/hooks/use-auth";
import {
  USERNAME_MAX_LENGTH,
  validateUsername,
} from "@/lib/constants/username";
import { cn } from "@/lib/utils";
import { exportMyData } from "@/lib/utils/export-my-data";

interface UserAccountPopoverProps {
  /** "compact" shows only the avatar, for crowded session headers. */
  variant?: "default" | "compact";
}

const ACCOUNT_LINKS = [
  { href: "/account", label: "Account", icon: UserRound },
  { href: "/account/sessions", label: "My sessions", icon: LayoutList },
  { href: "/orgs", label: "Organizations", icon: Building2 },
] as const;

export function UserAccountPopover({
  variant = "default",
}: UserAccountPopoverProps) {
  const {
    avatarUrl,
    githubUsername,
    isGitHubLinked,
    userId,
    displayName,
    isAnonymous,
    updateDisplayName,
  } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [nameError, setNameError] = useState("");

  if (!userId) {
    return null;
  }

  const name = displayName || "Guest";

  const startRename = () => {
    setNameDraft(displayName ?? "");
    setNameError("");
    setIsRenaming(true);
  };

  const saveName = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validateUsername(nameDraft);
    if (validationError) {
      setNameError(validationError);
      return;
    }
    const trimmed = nameDraft.trim();
    if (trimmed !== displayName) {
      const saved = await updateDisplayName(trimmed);
      if (!saved) {
        setNameError("Could not save your name. Please try again.");
        return;
      }
      toast.success("Name updated", {
        description: "Boards and sessions you open show your new name.",
      });
    }
    setIsRenaming(false);
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await exportMyData();
    } catch (error) {
      console.error("Failed to export data:", error);
      toast.error("Export failed", { description: "Please try again." });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Popover onOpenChange={setIsOpen} open={isOpen}>
      <PopoverTrigger asChild>
        <button
          aria-label={`Account and settings for ${name}`}
          className={cn(
            "flex h-9 shrink-0 items-center gap-2 rounded-full outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
            variant === "compact" ? "w-9 justify-center" : "pr-3 pl-0.5"
          )}
          type="button"
        >
          <Avatar name={name} size="md" src={avatarUrl} />
          {variant === "default" && (
            <span className="hidden max-w-28 truncate font-semibold text-sm sm:inline">
              {name}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="max-h-[calc(100dvh-5rem)] w-80 overflow-y-auto rounded-xl p-0"
      >
        <div className="flex items-center gap-3 border-border border-b-2 p-4">
          <Avatar name={name} src={avatarUrl} />
          <div className="min-w-0 flex-1">
            {isRenaming ? (
              <form className="space-y-1" onSubmit={saveName}>
                <div className="flex items-center gap-1">
                  <Input
                    aria-label="Display name"
                    autoFocus
                    className="h-8 rounded-lg"
                    maxLength={USERNAME_MAX_LENGTH}
                    onChange={(e) => {
                      setNameDraft(e.target.value);
                      setNameError("");
                    }}
                    value={nameDraft}
                  />
                  <Button
                    aria-label="Save name"
                    className="h-8 w-8 shrink-0 rounded-lg p-0"
                    type="submit"
                  >
                    <Check aria-hidden="true" className="h-4 w-4" />
                  </Button>
                  <Button
                    aria-label="Cancel"
                    className="h-8 w-8 shrink-0 rounded-lg p-0"
                    onClick={() => setIsRenaming(false)}
                    type="button"
                    variant="ghost"
                  >
                    <X aria-hidden="true" className="h-4 w-4" />
                  </Button>
                </div>
                {nameError && (
                  <p className="text-destructive text-xs" role="alert">
                    {nameError}
                  </p>
                )}
              </form>
            ) : (
              <>
                <button
                  className="group flex max-w-full items-center gap-1.5 rounded font-bold hover:text-brand-text"
                  onClick={startRename}
                  type="button"
                >
                  <span className="truncate">{name}</span>
                  <Pencil
                    aria-hidden="true"
                    className="h-3 w-3 shrink-0 text-muted-foreground group-hover:text-brand-text"
                  />
                  <span className="sr-only">Change name</span>
                </button>
                <p className="flex items-center gap-1 text-muted-foreground text-xs">
                  {isAnonymous ? (
                    "Guest on this browser"
                  ) : (
                    <>
                      <ShieldCheck aria-hidden="true" className="h-3.5 w-3.5" />
                      {githubUsername
                        ? `GitHub @${githubUsername}`
                        : isGitHubLinked
                          ? "Linked to GitHub"
                          : "Registered account"}
                    </>
                  )}
                </p>
              </>
            )}
          </div>
        </div>

        <div className="space-y-4 p-4">
          <div className="space-y-1.5">
            <p className="font-bold text-muted-foreground text-xs uppercase tracking-wide">
              Appearance
            </p>
            <ThemeSwitcher />
          </div>

          <nav aria-label="Account">
            <ul className="grid gap-1">
              {ACCOUNT_LINKS.map(({ href, label, icon: Icon }) => (
                <li key={href}>
                  <Link
                    className="flex items-center gap-2 rounded-lg px-3 py-2 font-semibold text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    href={href}
                    onClick={() => setIsOpen(false)}
                  >
                    <Icon aria-hidden="true" className="h-4 w-4" />
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {isAnonymous && (
            <LinkGitHubCard
              body="Link GitHub to keep your boards on any device and to join organizations."
              className="p-3"
              title="Keep your boards"
            />
          )}

          <Button
            className="w-full justify-start rounded-lg"
            disabled={isExporting}
            onClick={handleExport}
            size="sm"
            variant="ghost"
          >
            <Download aria-hidden="true" className="mr-2 h-4 w-4" />
            {isExporting ? "Preparing…" : "Export all my data (JSON)"}
          </Button>

          <SignOutButton className="w-full justify-start" variant="ghost" />
        </div>
      </PopoverContent>
    </Popover>
  );
}
