"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import type React from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FIELD_LIMITS } from "@/lib/constants/field-limits";
import { createOrganization } from "@/lib/organizations";
import { getErrorMessage } from "@/lib/utils/errors";

export function CreateOrganizationForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Give the organization a name.");
      return;
    }
    setIsCreating(true);
    setError("");
    try {
      const organization = await createOrganization(trimmed);
      router.push(`/orgs/${organization.slug}`);
    } catch (createError) {
      setError(
        getErrorMessage(createError, "Could not create the organization.")
      );
      setIsCreating(false);
    }
  };

  return (
    <form className="space-y-2" onSubmit={handleSubmit}>
      <Label className="font-bold" htmlFor="organization-name">
        Name
      </Label>
      <div className="flex flex-wrap gap-2">
        <Input
          aria-describedby={error ? "organization-name-error" : undefined}
          aria-invalid={!!error}
          autoComplete="organization"
          className="h-11 min-w-0 flex-1 basis-56 rounded-xl border-2 border-border"
          id="organization-name"
          maxLength={FIELD_LIMITS.organizationName}
          onChange={(event) => {
            setName(event.target.value);
            setError("");
          }}
          placeholder="Acme Platform Team"
          value={name}
        />
        <Button
          className="h-11 rounded-xl font-bold"
          disabled={isCreating}
          type="submit"
        >
          <Plus aria-hidden="true" className="mr-2 h-4 w-4" />
          {isCreating ? "Creating…" : "Create"}
        </Button>
      </div>
      {error && (
        <p
          className="text-destructive text-sm"
          id="organization-name-error"
          role="alert"
        >
          {error}
        </p>
      )}
    </form>
  );
}
