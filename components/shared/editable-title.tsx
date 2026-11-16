"use client";

import { Check, Pencil, X } from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface EditableTitleProps {
  canEdit: boolean;
  label: string;
  maxLength: number;
  onSave: (value: string) => void;
  value: string;
}

export function EditableTitle({
  canEdit,
  label,
  maxLength,
  onSave,
  value,
}: EditableTitleProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (!isEditing) {
      setDraft(value);
    }
  }, [isEditing, value]);

  const save = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) {
      onSave(trimmed);
    }
    setIsEditing(false);
  };

  const cancel = () => {
    setDraft(value);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      save();
    } else if (e.key === "Escape") {
      cancel();
    }
  };

  if (isEditing) {
    return (
      <div className="flex min-w-0 items-center gap-1.5">
        <Input
          aria-label={label}
          autoComplete="off"
          autoFocus
          className="h-8 w-full min-w-0 max-w-64 rounded-lg border border-border font-bold"
          maxLength={maxLength}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          value={draft}
        />
        <Button
          aria-label="Save"
          className="h-8 w-8 shrink-0 rounded-lg p-0"
          onClick={save}
        >
          <Check aria-hidden="true" className="h-4 w-4" />
        </Button>
        <Button
          aria-label="Cancel"
          className="h-8 w-8 shrink-0 rounded-lg p-0"
          onClick={cancel}
          variant="outline"
        >
          <X aria-hidden="true" className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  if (!canEdit) {
    return (
      <h1 className="truncate font-bold text-base md:text-lg" title={value}>
        {value}
      </h1>
    );
  }

  return (
    <h1 className="min-w-0">
      <button
        aria-label={`${label}: ${value}. Click to edit`}
        className="group flex max-w-full items-center gap-1.5 rounded-md text-left font-bold text-base outline-none transition-colors hover:text-brand-text focus-visible:ring-2 focus-visible:ring-ring md:text-lg"
        onClick={() => setIsEditing(true)}
        title={value}
        type="button"
      >
        <span className="truncate">{value}</span>
        <Pencil
          aria-hidden="true"
          className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-60 transition-opacity group-hover:opacity-100"
        />
      </button>
    </h1>
  );
}
