"use client";

import { formatDistanceToNow } from "date-fns";
import { Check, Copy, Link2, Link2Off, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { INVITE_EXPIRY_OPTIONS } from "@/lib/constants/organizations";
import {
  getInvite,
  inviteUrl,
  revokeInvite,
  rotateInvite,
} from "@/lib/organizations";
import type { OrganizationInvite } from "@/lib/types";
import { reportActionError } from "@/lib/utils/errors";

const NEVER = "never";

function expiryText(invite: OrganizationInvite) {
  if (!invite.expires_at) {
    return "Never expires.";
  }
  const expires = new Date(invite.expires_at);
  if (expires.getTime() <= Date.now()) {
    return "Expired. Reset the link to invite people again.";
  }
  return `Expires ${formatDistanceToNow(expires, { addSuffix: true })}.`;
}

/** The organization's invite link, for owners and admins. */
export function InvitePanel({
  orgId,
  refreshToken,
}: {
  orgId: string;
  /** Changes when the page reloads, for example after a removal resets the code. */
  refreshToken?: number;
}) {
  const [invite, setInvite] = useState<OrganizationInvite | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [expiry, setExpiry] = useState("7");
  const [isBusy, setIsBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirm, setConfirm] = useState<"reset" | "revoke" | null>(null);

  const load = useCallback(async () => {
    try {
      setInvite(await getInvite(orgId));
    } catch (error) {
      reportActionError("Load invite link", error);
    } finally {
      setIsLoaded(true);
    }
  }, [orgId]);

  // Reloads in place, keeping the chosen lifetime and without a loading flash.
  // biome-ignore lint/correctness/useExhaustiveDependencies: refreshToken only triggers a reload
  useEffect(() => {
    load();
  }, [load, refreshToken]);

  const create = async () => {
    setIsBusy(true);
    try {
      setInvite(
        await rotateInvite(orgId, expiry === NEVER ? null : Number(expiry))
      );
      toast.success(invite ? "New invite link created" : "Invite link created");
    } catch (error) {
      reportActionError("Create invite link", error);
    } finally {
      setIsBusy(false);
    }
  };

  const revoke = async () => {
    setIsBusy(true);
    try {
      await revokeInvite(orgId);
      setInvite(null);
      toast.success("Invite link turned off");
    } catch (error) {
      reportActionError("Turn off invite link", error);
    } finally {
      setIsBusy(false);
    }
  };

  const copy = async () => {
    if (!invite) {
      return;
    }
    try {
      await navigator.clipboard.writeText(inviteUrl(invite.code));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      reportActionError("Copy invite link", error);
    }
  };

  if (!isLoaded) {
    return (
      <p className="animate-pulse text-muted-foreground text-sm">Loading…</p>
    );
  }

  const expirySelect = (
    <div className="space-y-1">
      <Label className="font-bold text-xs" htmlFor="invite-expiry">
        Link lifetime
      </Label>
      <Select onValueChange={setExpiry} value={expiry}>
        <SelectTrigger
          className="h-10 w-36 rounded-lg border-2 border-border bg-background font-semibold"
          id="invite-expiry"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {INVITE_EXPIRY_OPTIONS.map((option) => (
            <SelectItem
              key={option.label}
              value={option.value === null ? NEVER : String(option.value)}
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Anyone with this link who has a GitHub-linked account can join as a
        member. Share it only with people you trust; reset it if it leaks.
      </p>

      {invite ? (
        <>
          <div className="space-y-1">
            <Label className="sr-only" htmlFor="invite-link">
              Invite link
            </Label>
            <div className="flex gap-2">
              <Input
                className="h-10 min-w-0 flex-1 rounded-lg border-2 border-border bg-background font-mono text-sm"
                id="invite-link"
                onFocus={(event) => event.currentTarget.select()}
                readOnly
                value={inviteUrl(invite.code)}
              />
              <Button
                className="h-10 rounded-lg font-bold"
                onClick={copy}
                variant="outline"
              >
                {copied ? (
                  <Check aria-hidden="true" className="mr-2 h-4 w-4" />
                ) : (
                  <Copy aria-hidden="true" className="mr-2 h-4 w-4" />
                )}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <p className="text-muted-foreground text-xs">
              {expiryText(invite)}
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            {expirySelect}
            <Button
              className="h-10 rounded-lg font-bold"
              disabled={isBusy}
              onClick={() => setConfirm("reset")}
              variant="outline"
            >
              <RefreshCw aria-hidden="true" className="mr-2 h-4 w-4" />
              Reset link
            </Button>
            <Button
              className="h-10 rounded-lg font-bold text-destructive hover:text-destructive"
              disabled={isBusy}
              onClick={() => setConfirm("revoke")}
              variant="ghost"
            >
              <Link2Off aria-hidden="true" className="mr-2 h-4 w-4" />
              Turn off
            </Button>
          </div>
        </>
      ) : (
        <div className="flex flex-wrap items-end gap-2">
          {expirySelect}
          <Button
            className="h-10 rounded-lg font-bold"
            disabled={isBusy}
            onClick={create}
          >
            <Link2 aria-hidden="true" className="mr-2 h-4 w-4" />
            {isBusy ? "Creating…" : "Create invite link"}
          </Button>
        </div>
      )}

      <AlertDialog
        onOpenChange={(open) => {
          if (!open) {
            setConfirm(null);
          }
        }}
        open={!!confirm}
      >
        <AlertDialogContent className="rounded-2xl border-2 border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-black text-xl">
              {confirm === "reset"
                ? "Reset the invite link?"
                : "Turn off the invite link?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === "reset"
                ? "The current link stops working at once. People who already joined stay members."
                : "Nobody can join with the link any more. People who already joined stay members."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-lg font-bold">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-lg font-bold"
              onClick={confirm === "reset" ? create : revoke}
            >
              {confirm === "reset" ? "Reset link" : "Turn off"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
