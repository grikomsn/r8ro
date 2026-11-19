"use client";

import { UserMinus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { RoleBadge } from "@/components/orgs/role-badge";
import { Avatar } from "@/components/shared/avatar";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ORGANIZATION_ROLES,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
} from "@/lib/constants/organizations";
import { removeMember, setMemberRole } from "@/lib/organizations";
import type { OrganizationMember, OrganizationRole } from "@/lib/types";
import { reportActionError } from "@/lib/utils/errors";

interface MembersPanelProps {
  members: OrganizationMember[];
  myRole: OrganizationRole;
  onChanged: () => void;
  orgId: string;
  orgName: string;
  userId: string;
}

function memberName(member: OrganizationMember) {
  return member.display_name || member.github_username || "Unnamed member";
}

export function MembersPanel({
  members,
  myRole,
  onChanged,
  orgId,
  orgName,
  userId,
}: MembersPanelProps) {
  const [removing, setRemoving] = useState<OrganizationMember | null>(null);
  // Role changes that are hard to undo wait for a confirmation: making
  // someone an owner (they can then remove you) and demoting yourself.
  const [pendingRole, setPendingRole] = useState<{
    member: OrganizationMember;
    role: OrganizationRole;
  } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const ownerCount = members.filter((member) => member.role === "owner").length;

  const changeRole = async (
    member: OrganizationMember,
    role: OrganizationRole
  ) => {
    setBusyId(member.user_id);
    try {
      await setMemberRole(orgId, member.user_id, role);
      toast.success(`${memberName(member)} is now ${ROLE_LABELS[role]}`);
      onChanged();
    } catch (error) {
      reportActionError("Change role", error);
    } finally {
      setBusyId(null);
    }
  };

  const confirmRemove = async () => {
    const member = removing;
    if (!member) {
      return;
    }
    setBusyId(member.user_id);
    try {
      await removeMember(orgId, member.user_id);
      toast.success(`${memberName(member)} was removed`);
      onChanged();
    } catch (error) {
      reportActionError("Remove member", error);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <ul className="divide-y-2 divide-border">
        {members.map((member) => {
          const isMe = member.user_id === userId;
          const name = memberName(member);
          // Owners change roles. The last owner cannot be demoted, which the
          // database refuses as well; disabling it avoids a pointless error.
          const canChangeRole =
            myRole === "owner" && !(member.role === "owner" && ownerCount <= 1);
          const canRemove =
            !isMe &&
            (myRole === "owner" ||
              (myRole === "admin" && member.role === "member"));

          return (
            <li
              className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3 first:pt-0 last:pb-0"
              key={member.user_id}
            >
              <Avatar name={name} src={member.avatar_url} />
              <div className="min-w-0 flex-1 basis-40">
                <p className="truncate font-bold">
                  {name}
                  {isMe && (
                    <span className="font-normal text-muted-foreground">
                      {" "}
                      (you)
                    </span>
                  )}
                </p>
                <p className="truncate text-muted-foreground text-xs">
                  {member.github_username
                    ? `@${member.github_username} · `
                    : ""}
                  joined {new Date(member.joined_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-1.5 max-sm:w-full max-sm:pl-11">
                {canChangeRole ? (
                  <Select
                    disabled={busyId === member.user_id}
                    onValueChange={(value) => {
                      const role = value as OrganizationRole;
                      const needsConfirm =
                        (role === "owner" && !isMe) ||
                        (isMe && role !== "owner");
                      if (needsConfirm) {
                        setPendingRole({ member, role });
                      } else {
                        changeRole(member, role);
                      }
                    }}
                    value={member.role}
                  >
                    <SelectTrigger
                      aria-label={`Role of ${name}`}
                      className="h-9 w-32 rounded-lg border-2 border-border font-semibold"
                    >
                      <SelectValue>{ROLE_LABELS[member.role]}</SelectValue>
                    </SelectTrigger>
                    <SelectContent align="end">
                      {ORGANIZATION_ROLES.map((role) => (
                        <SelectItem key={role} value={role}>
                          <span className="flex flex-col">
                            {ROLE_LABELS[role]}
                            <span className="max-w-56 text-muted-foreground text-xs">
                              {ROLE_DESCRIPTIONS[role]}
                            </span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <RoleBadge role={member.role} />
                )}
                {canRemove && (
                  <Button
                    aria-label={`Remove ${name}`}
                    className="h-9 w-9 rounded-lg p-0 text-muted-foreground hover:text-destructive"
                    disabled={busyId === member.user_id}
                    onClick={() => setRemoving(member)}
                    variant="ghost"
                  >
                    <UserMinus aria-hidden="true" className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <AlertDialog
        onOpenChange={(open) => {
          if (!open) {
            setPendingRole(null);
          }
        }}
        open={!!pendingRole}
      >
        <AlertDialogContent className="rounded-2xl border-2 border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-black text-xl">
              {pendingRole?.member.user_id === userId
                ? `Make yourself ${pendingRole ? ROLE_LABELS[pendingRole.role] : ""}?`
                : `Make ${pendingRole ? memberName(pendingRole.member) : ""} an owner?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingRole?.member.user_id === userId
                ? "You lose the owner's controls, including changing roles. Only another owner can give them back."
                : "Owners can change every role, remove anyone, including you, and delete the organization."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-lg font-bold">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-lg font-bold"
              onClick={() => {
                const pending = pendingRole;
                if (pending) {
                  changeRole(pending.member, pending.role);
                }
              }}
            >
              {pendingRole
                ? `Make ${ROLE_LABELS[pendingRole.role]}`
                : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        onOpenChange={(open) => {
          if (!open) {
            setRemoving(null);
          }
        }}
        open={!!removing}
      >
        <AlertDialogContent className="rounded-2xl border-2 border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-black text-xl">
              Remove {removing ? memberName(removing) : "member"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              They lose access to {orgName} and to its private sessions they did
              not create, and their votes there are withdrawn. Cards they added
              stay, and sessions they created stay in the organization. The
              invite link is reset so they cannot rejoin with it; share the new
              link with anyone still waiting to join.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-lg font-bold">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-lg bg-destructive font-bold text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmRemove}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
