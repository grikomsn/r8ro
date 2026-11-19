"use client";

import { formatDistanceToNow } from "date-fns";
import {
  Archive,
  ArchiveRestore,
  ArrowRightLeft,
  Building2,
  Globe,
  LayoutGrid,
  Lock,
  LockKeyhole,
  LockOpen,
  LogOut,
  MoreHorizontal,
  Pencil,
  Search,
  Spade,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import type React from "react";
import { useMemo, useState } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FIELD_LIMITS } from "@/lib/constants/field-limits";
import {
  deleteSession,
  leaveSession,
  moveSession,
  renameSession,
  sessionHref,
  setRetroLocked,
  setSessionArchived,
  setSessionVisibility,
} from "@/lib/sessions";
import type { ManagedSession } from "@/lib/types";
import { cn } from "@/lib/utils";
import { reportActionError } from "@/lib/utils/errors";

const PERSONAL = "personal";
/** `list_my_sessions` returns at most this many rows, newest first. */
const SESSION_LIST_LIMIT = 500;

export interface MoveTarget {
  id: string;
  name: string;
}

type KindFilter = "all" | "retro" | "poker";
type RelationFilter = "all" | "created" | "joined";
type StatusFilter = "active" | "archived";

interface ManagedSessionListProps {
  /** Shown when nothing at all is listed, before any filter applies. */
  emptyState: React.ReactNode;
  /** Organizations you belong to, offered when moving a session you wrote. */
  moveTargets: MoveTarget[];
  /** Called after a change so the caller can reload the list. */
  onChanged: () => void;
  sessions: ManagedSession[];
  /** Hides the organization chip, for lists inside one organization. */
  showOrganization?: boolean;
  /** Offers the created/joined filter, for your personal list. */
  showRelationFilter?: boolean;
  userId: string;
}

function relativeTime(timestamp: string) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return formatDistanceToNow(date, { addSuffix: true });
}

function Chip({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-bold text-[11px] leading-4",
        className
      )}
    >
      {children}
    </span>
  );
}

function FilterSelect<T extends string>({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: T) => void;
  options: { label: string; value: T }[];
  value: T;
}) {
  return (
    <Select onValueChange={(next) => onChange(next as T)} value={value}>
      <SelectTrigger
        aria-label={label}
        className="h-10 rounded-xl border-2 border-border bg-background font-semibold"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function ManagedSessionList({
  emptyState,
  moveTargets,
  onChanged,
  sessions,
  showOrganization = true,
  showRelationFilter = false,
  userId,
}: ManagedSessionListProps) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<KindFilter>("all");
  const [relation, setRelation] = useState<RelationFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("active");
  const [renaming, setRenaming] = useState<ManagedSession | null>(null);
  const [moving, setMoving] = useState<ManagedSession | null>(null);
  const [confirm, setConfirm] = useState<{
    kind: "delete" | "leave";
    session: ManagedSession;
  } | null>(null);

  const archivedCount = useMemo(
    () => sessions.filter((session) => session.archived_at).length,
    [sessions]
  );

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return sessions.filter((session) => {
      if ((status === "archived") !== !!session.archived_at) {
        return false;
      }
      if (kind !== "all" && session.kind !== kind) {
        return false;
      }
      if (relation === "created" && !session.is_author) {
        return false;
      }
      if (relation === "joined" && session.is_author) {
        return false;
      }
      return (
        !needle ||
        session.title.toLowerCase().includes(needle) ||
        session.slug.includes(needle)
      );
    });
  }, [sessions, query, kind, relation, status]);

  const run = async (
    action: string,
    work: () => Promise<void>,
    success?: string
  ) => {
    try {
      await work();
      if (success) {
        toast.success(success);
      }
      onChanged();
    } catch (error) {
      reportActionError(action, error);
    }
  };

  if (sessions.length === 0) {
    return <>{emptyState}</>;
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto] md:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
        <div className="relative max-sm:col-span-full">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            aria-label="Search sessions"
            className="h-10 rounded-xl border-2 border-border bg-background pl-9"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by title or code"
            type="search"
            value={query}
          />
        </div>
        <div className="grid grid-cols-2 gap-2 max-sm:col-span-full sm:contents">
          <FilterSelect<KindFilter>
            label="Session type"
            onChange={setKind}
            options={[
              { label: "All types", value: "all" },
              { label: "Retros", value: "retro" },
              { label: "Poker", value: "poker" },
            ]}
            value={kind}
          />
          <FilterSelect<StatusFilter>
            label="Status"
            onChange={setStatus}
            options={[
              { label: "Active", value: "active" },
              {
                label: `Archived${archivedCount ? ` (${archivedCount})` : ""}`,
                value: "archived",
              },
            ]}
            value={status}
          />
          {showRelationFilter && (
            <div className="max-md:col-span-full">
              <FilterSelect<RelationFilter>
                label="Created or joined"
                onChange={setRelation}
                options={[
                  { label: "Created or joined", value: "all" },
                  { label: "Created by me", value: "created" },
                  { label: "Joined", value: "joined" },
                ]}
                value={relation}
              />
            </div>
          )}
        </div>
      </div>

      {sessions.length >= SESSION_LIST_LIMIT && (
        <p className="rounded-xl bg-muted px-4 py-2 text-muted-foreground text-sm">
          Showing the newest {SESSION_LIST_LIMIT} sessions. Older ones are still
          open by their link.
        </p>
      )}

      {visible.length === 0 ? (
        <p className="rounded-xl border-2 border-border border-dashed px-4 py-8 text-center text-muted-foreground text-sm">
          {status === "archived"
            ? "Nothing archived matches."
            : "No sessions match these filters."}
        </p>
      ) : (
        <ul className="grid gap-2">
          {visible.map((session) => (
            <SessionRow
              key={`${session.kind}-${session.id}`}
              moveTargets={moveTargets}
              onAction={run}
              onConfirm={(kindOfConfirm) =>
                setConfirm({ kind: kindOfConfirm, session })
              }
              onMove={() => setMoving(session)}
              onRename={() => setRenaming(session)}
              session={session}
              showOrganization={showOrganization}
            />
          ))}
        </ul>
      )}

      <RenameDialog
        onClose={() => setRenaming(null)}
        onSave={(title) => {
          const target = renaming;
          if (!target) {
            return;
          }
          setRenaming(null);
          run("Rename session", () => renameSession(target, title), "Renamed");
        }}
        session={renaming}
      />

      <MoveDialog
        moveTargets={moveTargets}
        onClose={() => setMoving(null)}
        onMove={(orgId) => {
          const target = moving;
          if (!target) {
            return;
          }
          setMoving(null);
          run(
            "Move session",
            () => moveSession(target, orgId),
            orgId ? "Moved to the organization" : "Moved to your own sessions"
          );
        }}
        session={moving}
      />

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
              {confirm?.kind === "delete"
                ? `Delete “${confirm.session.title}”?`
                : `Leave “${confirm?.session.title ?? ""}”?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.kind === "delete"
                ? "Everything in it is permanently deleted for all participants. Export it first if you want to keep a copy."
                : // org_name is only readable by members of the organization.
                  confirm?.session.org_name
                  ? "It disappears from your sessions. Anything you added stays. As a member of its organization you can open it again from the organization page."
                  : "It disappears from your sessions. Anything you added stays. If it is private you need the host to make it public before you can rejoin."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-lg font-bold">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-lg bg-destructive font-bold text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                const target = confirm;
                if (!target) {
                  return;
                }
                if (target.kind === "delete") {
                  run(
                    "Delete session",
                    () => deleteSession(target.session),
                    "Deleted"
                  );
                } else {
                  run(
                    "Leave session",
                    () => leaveSession(target.session, userId),
                    "You left the session"
                  );
                }
              }}
            >
              {confirm?.kind === "delete" ? "Delete" : "Leave"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SessionRow({
  moveTargets,
  onAction,
  onConfirm,
  onMove,
  onRename,
  session,
  showOrganization,
}: {
  moveTargets: MoveTarget[];
  onAction: (
    action: string,
    work: () => Promise<void>,
    success?: string
  ) => void;
  onConfirm: (kind: "delete" | "leave") => void;
  onMove: () => void;
  onRename: () => void;
  session: ManagedSession;
  showOrganization: boolean;
}) {
  const time = relativeTime(session.created_at);
  const KindIcon = session.kind === "retro" ? LayoutGrid : Spade;
  const itemLabel =
    session.kind === "retro"
      ? `${session.item_count} card${session.item_count === 1 ? "" : "s"}`
      : `${session.item_count} round${session.item_count === 1 ? "" : "s"}`;
  // Only the author can move a session into an organization; a manager can
  // only hand an organization's session back to its author.
  const canMove =
    (session.is_author && (moveTargets.length > 0 || !!session.org_id)) ||
    (!session.is_author && session.can_manage && !!session.org_id);
  const canLeave = session.is_participant && !session.is_author;
  const hasMenu = session.can_manage || canMove || canLeave;

  return (
    <li className="group flex items-start gap-1 rounded-xl border-2 border-border bg-background pr-1.5 shadow-sm transition-[border-color,box-shadow] focus-within:border-primary hover:border-primary hover:shadow-md">
      <Link
        className="flex min-w-0 flex-1 flex-col gap-1.5 rounded-xl px-4 py-3 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        href={sessionHref(session)}
      >
        <span className="truncate font-bold">{session.title}</span>
        <span className="flex flex-wrap items-center gap-1">
          <Chip
            className={
              session.kind === "retro"
                ? "bg-sky text-ink"
                : "bg-periwinkle text-ink"
            }
          >
            <KindIcon aria-hidden="true" className="h-3 w-3" />
            {session.kind === "retro" ? "Retro" : "Poker"}
          </Chip>
          {showOrganization && session.org_name && (
            <Chip className="max-w-48 bg-sage text-ink">
              <Building2 aria-hidden="true" className="h-3 w-3 shrink-0" />
              <span className="truncate">{session.org_name}</span>
            </Chip>
          )}
          {!session.is_public && (
            <Chip className="bg-muted text-muted-foreground">
              <Lock aria-hidden="true" className="h-3 w-3" />
              Private
            </Chip>
          )}
          {session.is_locked && (
            <Chip className="bg-muted text-muted-foreground">
              <LockKeyhole aria-hidden="true" className="h-3 w-3" />
              Locked
            </Chip>
          )}
          {session.archived_at && (
            <Chip className="bg-muted text-muted-foreground">
              <Archive aria-hidden="true" className="h-3 w-3" />
              Archived
            </Chip>
          )}
        </span>
        <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-muted-foreground text-xs">
          <span className="truncate font-mono">{session.slug}</span>
          <span>
            {session.participant_count}{" "}
            {session.participant_count === 1 ? "person" : "people"} ·{" "}
            {itemLabel}
          </span>
          {time && <span>created {time}</span>}
          {!session.is_author && (
            <span className="truncate">by {session.author_name}</span>
          )}
        </span>
      </Link>
      {hasMenu && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              aria-label={`Actions for ${session.title}`}
              className="mt-2 h-9 w-9 shrink-0 rounded-lg p-0 text-muted-foreground"
              variant="ghost"
            >
              <MoreHorizontal aria-hidden="true" className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-60 rounded-xl border-2 border-border"
          >
            {session.can_manage && (
              <>
                <DropdownMenuItem onSelect={onRename}>
                  <Pencil aria-hidden="true" className="mr-2 h-4 w-4" />
                  Rename
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() =>
                    onAction(
                      "Change visibility",
                      () => setSessionVisibility(session, !session.is_public),
                      session.is_public ? "Now private" : "Now public"
                    )
                  }
                >
                  {session.is_public ? (
                    <Lock aria-hidden="true" className="mr-2 h-4 w-4" />
                  ) : (
                    <Globe aria-hidden="true" className="mr-2 h-4 w-4" />
                  )}
                  {session.is_public ? "Make private" : "Make public"}
                </DropdownMenuItem>
                {session.kind === "retro" && (
                  <DropdownMenuItem
                    onSelect={() =>
                      onAction(
                        "Change lock",
                        () => setRetroLocked(session, !session.is_locked),
                        session.is_locked ? "Board unlocked" : "Board locked"
                      )
                    }
                  >
                    {session.is_locked ? (
                      <LockOpen aria-hidden="true" className="mr-2 h-4 w-4" />
                    ) : (
                      <Lock aria-hidden="true" className="mr-2 h-4 w-4" />
                    )}
                    {session.is_locked ? "Unlock board" : "Lock board"}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onSelect={() =>
                    onAction(
                      session.archived_at ? "Restore session" : "Archive",
                      () => setSessionArchived(session, !session.archived_at),
                      session.archived_at ? "Restored" : "Archived"
                    )
                  }
                >
                  {session.archived_at ? (
                    <ArchiveRestore
                      aria-hidden="true"
                      className="mr-2 h-4 w-4"
                    />
                  ) : (
                    <Archive aria-hidden="true" className="mr-2 h-4 w-4" />
                  )}
                  {session.archived_at ? "Restore" : "Archive"}
                </DropdownMenuItem>
              </>
            )}
            {canMove && (
              <DropdownMenuItem onSelect={onMove}>
                <ArrowRightLeft aria-hidden="true" className="mr-2 h-4 w-4" />
                {session.is_author ? "Move…" : "Hand back to the author"}
              </DropdownMenuItem>
            )}
            {canLeave && (
              <DropdownMenuItem onSelect={() => onConfirm("leave")}>
                <LogOut aria-hidden="true" className="mr-2 h-4 w-4" />
                Leave
              </DropdownMenuItem>
            )}
            {session.can_manage && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                  onSelect={() => onConfirm("delete")}
                >
                  <Trash2 aria-hidden="true" className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </li>
  );
}

function RenameDialog({
  onClose,
  onSave,
  session,
}: {
  onClose: () => void;
  onSave: (title: string) => void;
  session: ManagedSession | null;
}) {
  const [title, setTitle] = useState("");
  const [shown, setShown] = useState<ManagedSession | null>(null);

  // Start from the current title each time the dialog opens; the parent
  // clears `session` on close, so reopening the same row resets the draft.
  if (session !== shown) {
    setShown(session);
    if (session) {
      setTitle(session.title);
    }
  }

  const trimmed = title.trim();

  return (
    <Dialog onOpenChange={(open) => !open && onClose()} open={!!session}>
      <DialogContent className="rounded-2xl border-2 border-border">
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (trimmed) {
              onSave(trimmed);
            }
          }}
        >
          <DialogHeader>
            <DialogTitle className="font-black text-xl">
              Rename session
            </DialogTitle>
            <DialogDescription>
              Everyone in the session sees the new title.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="font-bold" htmlFor="rename-session-title">
              Title
            </Label>
            <Input
              autoFocus
              className="h-11 rounded-xl border-2 border-border"
              id="rename-session-title"
              maxLength={FIELD_LIMITS.sessionTitle}
              onChange={(event) => setTitle(event.target.value)}
              value={title}
            />
          </div>
          <DialogFooter>
            <Button
              className="rounded-lg font-bold"
              onClick={onClose}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              className="rounded-lg font-bold"
              disabled={!trimmed || trimmed === session?.title}
              type="submit"
            >
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function MoveDialog({
  moveTargets,
  onClose,
  onMove,
  session,
}: {
  moveTargets: MoveTarget[];
  onClose: () => void;
  onMove: (orgId: string | null) => void;
  session: ManagedSession | null;
}) {
  const [target, setTarget] = useState(PERSONAL);
  const [shown, setShown] = useState<ManagedSession | null>(null);

  if (session !== shown) {
    setShown(session);
    if (session) {
      setTarget(session.org_id ?? PERSONAL);
    }
  }

  const current = session?.org_id ?? PERSONAL;
  const options = session?.is_author
    ? [
        { id: PERSONAL, name: "Only me (personal)" },
        ...moveTargets.map((org) => ({ id: org.id, name: org.name })),
      ]
    : [
        {
          id: PERSONAL,
          name: `${session?.author_name ?? "The author"} (personal)`,
        },
      ];
  // An organization you have left can still own the session; keep it listed
  // so the select shows where the session is now.
  if (
    session?.org_id &&
    !options.some((option) => option.id === session.org_id)
  ) {
    options.push({
      id: session.org_id,
      name: session.org_name ?? "Organization",
    });
  }

  return (
    <Dialog onOpenChange={(open) => !open && onClose()} open={!!session}>
      <DialogContent className="rounded-2xl border-2 border-border">
        <DialogHeader>
          <DialogTitle className="font-black text-xl">Move session</DialogTitle>
          <DialogDescription>
            Members of an organization can open its sessions, even private ones,
            and its owners and admins can host them. The author always stays the
            author.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label className="font-bold" htmlFor="move-session-target">
            Belongs to
          </Label>
          <Select onValueChange={setTarget} value={target}>
            <SelectTrigger
              className="h-11 w-full rounded-xl border-2 border-border"
              id="move-session-target"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button
            className="rounded-lg font-bold"
            onClick={onClose}
            variant="outline"
          >
            Cancel
          </Button>
          <Button
            className="rounded-lg font-bold"
            disabled={target === current}
            onClick={() => onMove(target === PERSONAL ? null : target)}
          >
            Move
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
