"use client";

import {
  ChevronLeft,
  ChevronRight,
  GripVertical,
  Lock,
  Pencil,
  Plus,
  ThumbsUp,
  Trash2,
} from "lucide-react";
import type React from "react";
import { useRef, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { FIELD_LIMITS } from "@/lib/constants/field-limits";
import type { ColumnType, RetroCard } from "@/lib/types";
import { cn } from "@/lib/utils";

export const COLUMN_CONFIG: Record<
  ColumnType,
  { header: string; prompt: string; title: string; accent: string }
> = {
  went_well: {
    title: "Went Well",
    prompt: "What helped the team this sprint?",
    header: "bg-chart-4 text-primary-foreground",
    accent: "bg-chart-4",
  },
  to_improve: {
    title: "To Improve",
    prompt: "What slowed us down or felt painful?",
    header: "bg-destructive text-destructive-foreground",
    accent: "bg-destructive",
  },
  action_items: {
    title: "Action Items",
    prompt: "What will we change next sprint, and who owns it?",
    header: "bg-chart-2 text-primary-foreground",
    accent: "bg-chart-2",
  },
};

export const COLUMN_ORDER: ColumnType[] = [
  "went_well",
  "to_improve",
  "action_items",
];

interface RetroColumnProps {
  cards: RetroCard[];
  columnType: ColumnType;
  currentUserId: string;
  draggedCardId: string | null;
  isLocked: boolean;
  myVotes: ReadonlySet<string>;
  onAddCard: (columnType: ColumnType, content: string) => void;
  onDeleteCard: (cardId: string) => void;
  onEditCard: (cardId: string, newContent: string) => void;
  onMoveCard: (cardId: string, newColumnType: ColumnType) => void;
  onVoteCard: (cardId: string) => void;
  pendingActions: Record<string, boolean>;
  setDraggedCardId: (cardId: string | null) => void;
}

function isSubmitShortcut(e: React.KeyboardEvent) {
  // Enter submits; Shift+Enter adds a newline. IME composition must not
  // submit half-typed text.
  return e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing;
}

function CardComposer({
  columnType,
  onAddCard,
}: {
  columnType: ColumnType;
  onAddCard: (columnType: ColumnType, content: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [content, setContent] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const submit = () => {
    const trimmed = content.trim();
    if (!trimmed) {
      return;
    }
    onAddCard(columnType, trimmed);
    // Keep the composer open so several thoughts can be added in a row.
    setContent("");
    textareaRef.current?.focus();
  };

  const close = () => {
    setIsOpen(false);
    setContent("");
  };

  if (!isOpen) {
    return (
      <Button
        aria-label={`Add a card to ${COLUMN_CONFIG[columnType].title}`}
        className="h-11 w-full rounded-lg border-2 border-border/60 border-dashed font-bold hover:border-border hover:bg-muted"
        onClick={() => setIsOpen(true)}
        variant="outline"
      >
        <Plus aria-hidden="true" className="mr-1.5 h-5 w-5" />
        Add card
      </Button>
    );
  }

  return (
    <form
      className="rounded-lg border-2 border-border bg-muted p-2.5 shadow-sm"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <Textarea
        aria-label={`New card for ${COLUMN_CONFIG[columnType].title}`}
        autoFocus
        className="min-h-20 resize-y rounded-lg border border-border bg-background text-sm"
        maxLength={FIELD_LIMITS.cardContent}
        onBlur={() => {
          if (!content.trim()) {
            setIsOpen(false);
          }
        }}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={(e) => {
          if (isSubmitShortcut(e)) {
            e.preventDefault();
            submit();
          } else if (e.key === "Escape") {
            close();
          }
        }}
        placeholder={COLUMN_CONFIG[columnType].prompt}
        ref={textareaRef}
        value={content}
      />
      <div className="mt-2 flex items-center gap-2">
        <Button
          className="h-9 rounded-lg font-bold"
          disabled={!content.trim()}
          type="submit"
        >
          Add
        </Button>
        <Button
          className="h-9 rounded-lg"
          onClick={close}
          type="button"
          variant="ghost"
        >
          Done
        </Button>
        <span className="ml-auto hidden text-muted-foreground text-xs sm:inline">
          Enter to add · Shift+Enter for a new line
        </span>
      </div>
    </form>
  );
}

export function RetroColumn({
  cards,
  columnType,
  currentUserId,
  draggedCardId,
  isLocked,
  myVotes,
  onAddCard,
  onDeleteCard,
  onEditCard,
  onMoveCard,
  onVoteCard,
  pendingActions,
  setDraggedCardId,
}: RetroColumnProps) {
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  // Deleting a card removes it and its votes for every participant, so it is
  // confirmed before it happens.
  const [cardPendingDelete, setCardPendingDelete] = useState<string | null>(
    null
  );

  const config = COLUMN_CONFIG[columnType];
  const columnIndex = COLUMN_ORDER.indexOf(columnType);
  const previousColumn = columnIndex > 0 ? COLUMN_ORDER[columnIndex - 1] : null;
  const nextColumn =
    columnIndex < COLUMN_ORDER.length - 1
      ? COLUMN_ORDER[columnIndex + 1]
      : null;

  const totalVotes = cards.reduce((sum, card) => sum + card.votes, 0);

  // Highest voted first; ties keep the order in which cards were added.
  const sortedCards = [...cards].sort(
    (a, b) =>
      b.votes - a.votes ||
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  const saveEdit = () => {
    const trimmed = editContent.trim();
    if (editingCardId && trimmed) {
      const original = cards.find((card) => card.id === editingCardId);
      if (original?.content !== trimmed) {
        onEditCard(editingCardId, trimmed);
      }
    }
    setEditingCardId(null);
    setEditContent("");
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const cardId = e.dataTransfer.getData("text/plain") || draggedCardId;
    if (isLocked || !cardId) {
      return;
    }
    const card = cards.find((c) => c.id === cardId);
    if (!card) {
      onMoveCard(cardId, columnType);
    }
    setDraggedCardId(null);
  };

  return (
    <section
      aria-labelledby={`column-${columnType}-heading`}
      className="flex h-full min-h-0 min-w-0 flex-col"
    >
      <div
        className={cn(
          // On phones the column switcher above the board names the column.
          "rounded-t-xl border-2 border-border border-b-0 px-3 py-2.5 max-md:sr-only md:px-4",
          config.header
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <h2
            className="truncate font-black text-base uppercase"
            id={`column-${columnType}-heading`}
          >
            {config.title}
          </h2>
          <div className="flex shrink-0 items-center gap-1.5 text-xs">
            {isLocked && (
              <Lock aria-label="Locked" className="h-4 w-4 opacity-80" />
            )}
            <span
              className="rounded-md border border-border bg-background px-2 py-0.5 font-bold text-foreground"
              title={`${cards.length} cards, ${totalVotes} votes`}
            >
              {cards.length}
              <span className="sr-only"> cards</span>
            </span>
          </div>
        </div>
      </div>

      {/* biome-ignore lint/a11y/noStaticElementInteractions: a drag-and-drop target; keyboard users move cards with the move buttons */}
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto border-2 border-border bg-background p-3 shadow-sm transition-colors md:p-3.5",
          "rounded-xl md:rounded-t-none md:border-t-0",
          isDragOver && !isLocked && "bg-muted ring-2 ring-primary ring-inset"
        )}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
            setIsDragOver(false);
          }
        }}
        onDragOver={(e) => {
          if (isLocked) {
            return;
          }
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          setIsDragOver(true);
        }}
        onDrop={handleDrop}
      >
        {isLocked ? (
          <p
            className="flex items-center justify-center gap-2 rounded-lg border-2 border-border/50 border-dashed p-3 text-muted-foreground text-sm"
            role="status"
          >
            <Lock aria-hidden="true" className="h-4 w-4" />
            Board is locked
          </p>
        ) : (
          <CardComposer columnType={columnType} onAddCard={onAddCard} />
        )}

        {sortedCards.length === 0 && (
          <p className="px-2 py-6 text-center text-muted-foreground text-sm">
            {isLocked ? "No cards." : config.prompt}
          </p>
        )}

        <ul className="flex flex-col gap-2.5">
          {sortedCards.map((card) => {
            const isTemp = card.id.startsWith("temp-");
            const hasVoted = myVotes.has(card.id);
            const isMine = card.author_id === currentUserId;
            const isEditing = editingCardId === card.id && !isLocked;
            const canAct = !(isLocked || isTemp);

            return (
              <li
                className={cn(
                  "group relative rounded-xl border-2 bg-background p-3 shadow-sm transition-[box-shadow,opacity,border-color] hover:shadow-md",
                  hasVoted ? "border-primary" : "border-border",
                  canAct && !isEditing && "cursor-grab active:cursor-grabbing",
                  (draggedCardId === card.id || isTemp) && "opacity-50"
                )}
                draggable={canAct && !isEditing}
                key={card.id}
                onDragEnd={() => setDraggedCardId(null)}
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/plain", card.id);
                  setDraggedCardId(card.id);
                }}
              >
                {isEditing ? (
                  <div className="space-y-2">
                    <Textarea
                      aria-label="Edit card"
                      autoFocus
                      className="min-h-20 resize-y rounded-lg border border-border text-sm"
                      maxLength={FIELD_LIMITS.cardContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      onFocus={(e) =>
                        e.currentTarget.setSelectionRange(
                          e.currentTarget.value.length,
                          e.currentTarget.value.length
                        )
                      }
                      onKeyDown={(e) => {
                        if (isSubmitShortcut(e)) {
                          e.preventDefault();
                          saveEdit();
                        } else if (e.key === "Escape") {
                          setEditingCardId(null);
                        }
                      }}
                      value={editContent}
                    />
                    <div className="flex gap-2">
                      <Button
                        className="h-8 rounded-lg font-bold text-xs"
                        disabled={!editContent.trim()}
                        onClick={saveEdit}
                      >
                        Save
                      </Button>
                      <Button
                        className="h-8 rounded-lg text-xs"
                        onClick={() => setEditingCardId(null)}
                        variant="ghost"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-1.5">
                    {canAct && (
                      <GripVertical
                        aria-hidden="true"
                        className="mt-0.5 -ml-1 hidden h-4 w-4 shrink-0 text-muted-foreground/60 md:block"
                      />
                    )}
                    <p className="min-w-0 flex-1 whitespace-pre-wrap break-words text-sm leading-relaxed">
                      {card.content}
                    </p>
                  </div>
                )}

                <div className="mt-2.5 flex items-center gap-1">
                  <span className="min-w-0 flex-1 truncate text-muted-foreground text-xs">
                    {isMine ? (
                      <span className="font-bold text-foreground">You</span>
                    ) : (
                      card.author_name
                    )}
                  </span>

                  {canAct && !isEditing && (
                    <div
                      aria-label="Card actions"
                      className="flex items-center opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100"
                      role="group"
                    >
                      {previousColumn && (
                        <Button
                          aria-label={`Move to ${COLUMN_CONFIG[previousColumn].title}`}
                          className="h-8 w-8 rounded-lg p-0"
                          disabled={pendingActions[`move-${card.id}`]}
                          onClick={() => onMoveCard(card.id, previousColumn)}
                          title={`Move to ${COLUMN_CONFIG[previousColumn].title}`}
                          variant="ghost"
                        >
                          <ChevronLeft aria-hidden="true" className="h-4 w-4" />
                        </Button>
                      )}
                      {nextColumn && (
                        <Button
                          aria-label={`Move to ${COLUMN_CONFIG[nextColumn].title}`}
                          className="h-8 w-8 rounded-lg p-0"
                          disabled={pendingActions[`move-${card.id}`]}
                          onClick={() => onMoveCard(card.id, nextColumn)}
                          title={`Move to ${COLUMN_CONFIG[nextColumn].title}`}
                          variant="ghost"
                        >
                          <ChevronRight
                            aria-hidden="true"
                            className="h-4 w-4"
                          />
                        </Button>
                      )}
                      <Button
                        aria-label="Edit card"
                        className="h-8 w-8 rounded-lg p-0"
                        disabled={pendingActions[`edit-${card.id}`]}
                        onClick={() => {
                          setEditingCardId(card.id);
                          setEditContent(card.content);
                        }}
                        title="Edit"
                        variant="ghost"
                      >
                        <Pencil aria-hidden="true" className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        aria-label="Delete card"
                        className="h-8 w-8 rounded-lg p-0 hover:text-destructive"
                        disabled={pendingActions[`delete-${card.id}`]}
                        onClick={() => setCardPendingDelete(card.id)}
                        title="Delete"
                        variant="ghost"
                      >
                        <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}

                  <Button
                    aria-label={
                      hasVoted
                        ? `Remove your vote. ${card.votes} vote${card.votes === 1 ? "" : "s"}`
                        : `Vote for this card. ${card.votes} vote${card.votes === 1 ? "" : "s"}`
                    }
                    aria-pressed={hasVoted}
                    className={cn(
                      "ml-1 h-8 shrink-0 gap-1 rounded-lg border-2 px-2 font-bold text-sm",
                      hasVoted
                        ? "border-primary bg-primary text-primary-foreground hover:bg-primary/85"
                        : "border-border"
                    )}
                    disabled={
                      isLocked || isTemp || pendingActions[`vote-${card.id}`]
                    }
                    onClick={() => onVoteCard(card.id)}
                    title={hasVoted ? "Remove your vote" : "Vote"}
                    variant={hasVoted ? "default" : "outline"}
                  >
                    <ThumbsUp
                      aria-hidden="true"
                      className={cn("h-3.5 w-3.5", hasVoted && "fill-current")}
                    />
                    {card.votes}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <AlertDialog
        onOpenChange={(open) => {
          if (!open) {
            setCardPendingDelete(null);
          }
        }}
        open={cardPendingDelete !== null}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this card?</AlertDialogTitle>
            <AlertDialogDescription>
              The card and its votes are removed for everyone on this board.
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (cardPendingDelete) {
                  onDeleteCard(cardPendingDelete);
                }
                setCardPendingDelete(null);
              }}
            >
              Delete card
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
