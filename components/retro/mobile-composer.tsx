"use client";

import { ArrowUp } from "lucide-react";
import { useRef, useState } from "react";
import {
  COLUMN_CONFIG,
  isSubmitShortcut,
} from "@/components/retro/retro-column";
import { Button } from "@/components/ui/button";
import { FIELD_LIMITS } from "@/lib/constants/field-limits";
import type { ColumnType } from "@/lib/types";
import { cn } from "@/lib/utils";

interface MobileComposerProps {
  columnType: ColumnType;
  onAddCard: (columnType: ColumnType, content: string) => void;
}

/**
 * A chat-style composer pinned to the bottom of the screen on phones, so a
 * card can be added with the thumb without scrolling back to the top of the
 * column.
 */
export function MobileComposer({ columnType, onAddCard }: MobileComposerProps) {
  const [content, setContent] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const config = COLUMN_CONFIG[columnType];

  const resize = () => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
    }
  };

  const submit = () => {
    const trimmed = content.trim();
    if (!trimmed) {
      return;
    }
    onAddCard(columnType, trimmed);
    setContent("");
    requestAnimationFrame(resize);
    textareaRef.current?.focus();
  };

  return (
    <form
      className="flex items-end gap-2 border-border border-t-2 bg-background px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:hidden"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <label className="flex min-w-0 flex-1 items-start gap-2 rounded-xl border-2 border-border bg-muted/50 px-3 py-2 focus-within:border-primary">
        <span
          aria-hidden="true"
          className={cn("mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full", config.dot)}
        />
        <span className="sr-only">New card for {config.title}</span>
        <textarea
          className="max-h-32 min-h-6 w-full resize-none bg-transparent text-base leading-6 outline-none placeholder:text-muted-foreground"
          enterKeyHint="send"
          maxLength={FIELD_LIMITS.cardContent}
          onChange={(e) => {
            setContent(e.target.value);
            resize();
          }}
          onKeyDown={(e) => {
            if (isSubmitShortcut(e)) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={config.composer}
          ref={textareaRef}
          rows={1}
          value={content}
        />
      </label>
      <Button
        aria-label="Add card"
        className="h-11 w-11 shrink-0 rounded-xl p-0 disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100"
        disabled={!content.trim()}
        type="submit"
      >
        <ArrowUp aria-hidden="true" className="h-5 w-5" />
      </Button>
    </form>
  );
}
