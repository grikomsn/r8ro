"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FIELD_LIMITS } from "@/lib/constants/field-limits";
import { NON_ESTIMATE_VALUES } from "@/lib/constants/poker-scales";
import { cn } from "@/lib/utils";

interface NextRoundDialogProps {
  currentStory: string | null;
  isSubmitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (estimate: string, nextStory: string) => void;
  open: boolean;
  scale: string[];
  suggestion: string | null;
}

export function NextRoundDialog({
  currentStory,
  isSubmitting,
  onOpenChange,
  onSubmit,
  open,
  scale,
  suggestion,
}: NextRoundDialogProps) {
  const [estimate, setEstimate] = useState("");
  const [nextStory, setNextStory] = useState("");

  useEffect(() => {
    if (open) {
      setEstimate(suggestion ?? "");
      setNextStory("");
    }
  }, [open, suggestion]);

  const options = scale.filter((value) => !NON_ESTIMATE_VALUES.has(value));

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="rounded-2xl border-2 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-black text-xl">
            Save estimate and move on
          </DialogTitle>
          <DialogDescription>
            {currentStory
              ? `“${currentStory.length > 80 ? `${currentStory.slice(0, 80)}…` : currentStory}” is saved to the history with the votes.`
              : "This round is saved to the history with the votes."}
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit(estimate, nextStory);
          }}
        >
          <fieldset className="space-y-2">
            <legend className="mb-2 font-bold text-sm">Final estimate</legend>
            <div className="flex flex-wrap gap-1.5">
              {options.map((value) => (
                <button
                  aria-pressed={estimate === value}
                  className={cn(
                    "h-10 min-w-10 rounded-lg border-2 px-2 font-black font-mono transition-colors",
                    estimate === value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border hover:border-primary"
                  )}
                  key={value}
                  onClick={() => setEstimate(value)}
                  type="button"
                >
                  {value}
                </button>
              ))}
            </div>
            <Input
              aria-label="Custom estimate"
              className="h-10 rounded-lg"
              maxLength={FIELD_LIMITS.voteValue}
              onChange={(e) => setEstimate(e.target.value)}
              placeholder="Or type a custom value"
              value={estimate}
            />
          </fieldset>
          <div className="space-y-2">
            <Label className="font-bold text-sm" htmlFor="next-story">
              Next story{" "}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            </Label>
            <Textarea
              className="min-h-20 rounded-lg"
              id="next-story"
              maxLength={FIELD_LIMITS.story}
              onChange={(e) => setNextStory(e.target.value)}
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  (e.metaKey || e.ctrlKey) &&
                  !e.nativeEvent.isComposing
                ) {
                  e.preventDefault();
                  onSubmit(estimate, nextStory);
                }
              }}
              placeholder="PROJ-124 · Next thing to estimate"
              value={nextStory}
            />
          </div>
          <DialogFooter>
            <Button
              onClick={() => onOpenChange(false)}
              type="button"
              variant="ghost"
            >
              Cancel
            </Button>
            <Button className="font-bold" disabled={isSubmitting} type="submit">
              {isSubmitting ? "Saving…" : "Save and start next"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
