"use client";

import { LogOut, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import type React from "react";
import { useState } from "react";
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
import { FIELD_LIMITS } from "@/lib/constants/field-limits";
import { isOrgManager } from "@/lib/constants/organizations";
import {
  deleteOrganization,
  removeMember,
  renameOrganization,
} from "@/lib/organizations";
import type { Organization, OrganizationRole } from "@/lib/types";
import { getErrorMessage, reportActionError } from "@/lib/utils/errors";

interface OrganizationSettingsProps {
  isSoleOwner: boolean;
  myRole: OrganizationRole;
  onRenamed: (organization: Organization) => void;
  organization: Organization;
  userId: string;
}

function RenameForm({
  onRenamed,
  organization,
}: Pick<OrganizationSettingsProps, "onRenamed" | "organization">) {
  const [name, setName] = useState(organization.name);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const trimmed = name.trim();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!trimmed) {
      setError("The name cannot be empty.");
      return;
    }
    setIsSaving(true);
    try {
      const renamed = await renameOrganization(organization.id, trimmed);
      onRenamed(renamed);
      toast.success("Organization renamed");
    } catch (renameError) {
      setError(getErrorMessage(renameError, "Could not rename."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form className="space-y-2" onSubmit={handleSubmit}>
      <Label className="font-bold" htmlFor="organization-rename">
        Name
      </Label>
      <div className="flex flex-wrap gap-2">
        <Input
          aria-invalid={!!error}
          className="h-11 min-w-0 flex-1 basis-56 rounded-xl border-2 border-border"
          id="organization-rename"
          maxLength={FIELD_LIMITS.organizationName}
          onChange={(event) => {
            setName(event.target.value);
            setError("");
          }}
          value={name}
        />
        <Button
          className="h-11 rounded-xl font-bold"
          disabled={isSaving || trimmed === organization.name}
          type="submit"
        >
          {isSaving ? "Saving…" : "Save"}
        </Button>
      </div>
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : (
        <p className="text-muted-foreground text-xs">
          The address{" "}
          <span className="font-mono">/orgs/{organization.slug}</span> stays the
          same.
        </p>
      )}
    </form>
  );
}

export function OrganizationSettings({
  isSoleOwner,
  myRole,
  onRenamed,
  organization,
  userId,
}: OrganizationSettingsProps) {
  const router = useRouter();
  const [confirm, setConfirm] = useState<"leave" | "delete" | null>(null);
  const [deleteName, setDeleteName] = useState("");

  const leave = async () => {
    try {
      await removeMember(organization.id, userId);
      toast.success(`You left ${organization.name}`);
      router.push("/orgs");
    } catch (error) {
      reportActionError("Leave organization", error);
    }
  };

  const remove = async () => {
    try {
      await deleteOrganization(organization.id);
      toast.success(`${organization.name} was deleted`);
      router.push("/orgs");
    } catch (error) {
      reportActionError("Delete organization", error);
    }
  };

  return (
    <div className="space-y-8">
      {isOrgManager(myRole) && (
        <RenameForm onRenamed={onRenamed} organization={organization} />
      )}

      <div className="space-y-2">
        <h2 className="font-bold">Leave the organization</h2>
        <p className="text-muted-foreground text-sm">
          {isSoleOwner
            ? "You are the only owner. Make someone else an owner first, or delete the organization."
            : "You lose access to its private sessions that you did not create. Sessions you created stay in the organization."}
        </p>
        <Button
          className="rounded-lg font-bold"
          disabled={isSoleOwner}
          onClick={() => setConfirm("leave")}
          variant="outline"
        >
          <LogOut aria-hidden="true" className="mr-2 h-4 w-4" />
          Leave
        </Button>
      </div>

      {myRole === "owner" && (
        <div className="space-y-2 rounded-xl border-2 border-destructive/30 p-4">
          <h2 className="font-bold text-destructive">
            Delete the organization
          </h2>
          <p className="text-muted-foreground text-sm">
            Members and the invite link are removed. Sessions are kept and go
            back to the people who created them.
          </p>
          <Button
            className="rounded-lg bg-destructive font-bold text-destructive-foreground hover:bg-destructive/90"
            onClick={() => {
              setDeleteName("");
              setConfirm("delete");
            }}
          >
            <Trash2 aria-hidden="true" className="mr-2 h-4 w-4" />
            Delete organization
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
              {confirm === "delete"
                ? `Delete ${organization.name}?`
                : `Leave ${organization.name}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === "delete"
                ? "This cannot be undone. Sessions are kept and go back to the people who created them."
                : "You can rejoin with the organization's invite link while it is active, or ask an owner or admin for a new one."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {confirm === "delete" && (
            <div className="space-y-2">
              <Label className="font-bold" htmlFor="confirm-delete-org">
                Type <span className="font-mono">{organization.name}</span> to
                confirm
              </Label>
              <Input
                autoComplete="off"
                className="h-10 rounded-lg border-2 border-border"
                id="confirm-delete-org"
                onChange={(event) => setDeleteName(event.target.value)}
                value={deleteName}
              />
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-lg font-bold">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-lg bg-destructive font-bold text-destructive-foreground hover:bg-destructive/90"
              disabled={
                confirm === "delete" && deleteName.trim() !== organization.name
              }
              onClick={confirm === "delete" ? remove : leave}
            >
              {confirm === "delete" ? "Delete" : "Leave"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
