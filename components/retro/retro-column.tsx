"use client";

import {
  ArrowLeftRight,
  MoreHorizontal,
  Pencil,
  Plus,
  ThumbsUp,
  Trash2,
} from "lucide-react";
import type React from "react";
import { useRef, useState } from "react";
import type { CardSortMode } from "@/components/retro/board-header";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { FIELD_LIMITS } from "@/lib/constants/field-limits";
import type { ColumnType, RetroCard } from "@/lib/types";
import { cn } from "@/lib/utils";

export const COLUMN_CONFIG: Record<
  ColumnType,
  {
    composer: string;
    dot: string;
    /** Light tint of the column colour behind the white cards. */
    lane: string;
    /** Wayfindr-style filled pill for the column title. */
    pill: string;
    prompt: string;
    title: string;
  }
> = {
  went_well: {
    title: "Went well",
    composer: "Something that went well…",
    prompt: "What helped the team this sprint?",
    dot: "bg-success",
    lane: "bg-success/[0.07]",
    pill: "bg-success text-success-foreground",
  },
  to_improve: {
    title: "To improve",
    composer: "Something to improve…",
    prompt: "What slowed us down or felt painful?",
    dot: "bg-mauve",
    lane: "bg-mauve/[0.07]",
    pill: "bg-mauve text-mauve-foreground",
  },
  action_items: {
    title: "Action items",
    composer: "An action item, and who owns it…",
    prompt: "What will we change next sprint, and who owns it?",
    dot: "bg-periwinkle",
    lane: "bg-periwinkle/[0.14]",
    pill: "bg-periwinkle text-ink",
  },
};

export const COLUMN_ORDER: ColumnType[] = [
  "went_well",
  "to_improve",
  "action_items",
];

export function isSubmitShortcut(e: React.KeyboardEvent) {
  // Enter submits; Shift+Enter adds a newline. IME composition must not
  // submit half-typed text.
  return e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing;
}

export function sortCards(
  cards: RetroCard[],
  mode: Exclude<CardSortMode, "auto">
) {
  const byAdded = (a: RetroCard, b: RetroCard) =>
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  return [...cards].sort(
    mode === "votes" ? (a, b) => b.votes - a.votes || byAdded(a, b) : byAdded
  );
}

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
  sortMode: Exclude<CardSortMode, "auto">;
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
        className="h-10 w-full justify-start rounded-lg border-2 border-border border-dashed bg-transparent px-3 font-semibold text-muted-foreground shadow-none hover:border-border hover:bg-muted hover:text-foreground"
        onClick={() => setIsOpen(true)}
        variant="outline"
      >
        <Plus aria-hidden="true" className="mr-1.5 h-4 w-4" />
        Add a card
      </Button>
    );
  }

  return (
    <form
      className="rounded-xl border-2 border-primary bg-background p-2 shadow-sm"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <Textarea
        aria-label={`New card for ${COLUMN_CONFIG[columnType].title}`}
        autoFocus
        className="min-h-20 resize-none border-0 bg-transparent p-1.5 text-sm shadow-none focus-visible:ring-0"
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
      <div className="flex items-center gap-2 pt-1">
        <span className="text-muted-foreground text-xs">
          Enter to add · Shift+Enter new line
        </span>
        <Button
          className="ml-auto h-8 rounded-lg"
          onClick={close}
          type="button"
          variant="ghost"
        >
          Done
        </Button>
        <Button
          className="h-8 rounded-lg font-bold"
          disabled={!content.trim()}
          type="submit"
        >
          Add
        </Button>
      </div>
    </form>
  );
}

function CardItem({
  card,
  columnType,
  currentUserId,
  draggedCardId,
  hasVoted,
  isLocked,
  onDelete,
  onEditCard,
  onMoveCard,
  onVoteCard,
  pendingActions,
  setDraggedCardId,
}: {
  card: RetroCard;
  columnType: ColumnType;
  currentUserId: string;
  draggedCardId: string | null;
  hasVoted: boolean;
  isLocked: boolean;
  onDelete: () => void;
  onEditCard: (cardId: string, newContent: string) => void;
  onMoveCard: (cardId: string, newColumnType: ColumnType) => void;
  onVoteCard: (cardId: string) => void;
  pendingActions: Record<string, boolean>;
  setDraggedCardId: (cardId: string | null) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const isTemp = card.id.startsWith("temp-");
  const isMine = card.author_id === currentUserId;
  const canAct = !(isLocked || isTemp);

  const startEdit = () => {
    setDraft(card.content);
    setIsEditing(true);
  };

  const saveEdit = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== card.content) {
      onEditCard(card.id, trimmed);
    }
    setIsEditing(false);
  };

  return (
    <li
      className={cn(
        "group relative rounded-xl border-2 bg-background p-3 shadow-xs transition-[box-shadow,opacity,border-color]",
        hasVoted ? "border-primary" : "border-border",
        canAct &&
          !isEditing &&
          "cursor-grab hover:shadow-md active:cursor-grabbing",
        (draggedCardId === card.id || isTemp) && "opacity-50"
      )}
      draggable={canAct && !isEditing}
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
            className="min-h-20 resize-y rounded-lg text-sm"
            maxLength={FIELD_LIMITS.cardContent}
            onChange={(e) => setDraft(e.target.value)}
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
                setIsEditing(false);
              }
            }}
            value={draft}
          />
          <div className="flex justify-end gap-2">
            <Button
              className="h-8 rounded-lg"
              onClick={() => setIsEditing(false)}
              variant="ghost"
            >
              Cancel
            </Button>
            <Button
              className="h-8 rounded-lg font-bold"
              disabled={!draft.trim()}
              onClick={saveEdit}
            >
              Save
            </Button>
          </div>
        </div>
      ) : (
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
          {card.content}
        </p>
      )}

      {!isEditing && (
        <div className="mt-2.5 flex items-center gap-1.5">
          <Avatar className="ring-0" name={card.author_name} size="sm" />
          <span className="min-w-0 flex-1 truncate text-muted-foreground text-xs">
            {isMine ? "You" : card.author_name}
          </span>

          {canAct && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  aria-label="Card options"
                  className="h-8 w-8 rounded-lg p-0 text-muted-foreground md:opacity-0 md:data-[state=open]:opacity-100 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
                  variant="ghost"
                >
                  <MoreHorizontal aria-hidden="true" className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-52 rounded-xl border-2 border-border"
              >
                <DropdownMenuItem
                  disabled={pendingActions[`edit-${card.id}`]}
                  onSelect={startEdit}
                >
                  <Pencil aria-hidden="true" className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                {COLUMN_ORDER.filter((type) => type !== columnType).map(
                  (type) => (
                    <DropdownMenuItem
                      disabled={pendingActions[`move-${card.id}`]}
                      key={type}
                      onSelect={() => onMoveCard(card.id, type)}
                    >
                      <ArrowLeftRight
                        aria-hidden="true"
                        className="mr-2 h-4 w-4"
                      />
                      Move to “{COLUMN_CONFIG[type].title}”
                    </DropdownMenuItem>
                  )
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                  disabled={pendingActions[`delete-${card.id}`]}
                  onSelect={onDelete}
                >
                  <Trash2 aria-hidden="true" className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <Button
            aria-label={
              hasVoted
                ? `Remove your vote. ${card.votes} vote${card.votes === 1 ? "" : "s"}`
                : `Vote for this card. ${card.votes} vote${card.votes === 1 ? "" : "s"}`
            }
            aria-pressed={hasVoted}
            className={cn(
              "h-8 min-w-12 shrink-0 gap-1 rounded-lg border-2 px-2 font-bold text-sm",
              hasVoted
                ? "border-primary bg-primary text-primary-foreground hover:bg-primary/85"
                : "border-border bg-background"
            )}
            disabled={isLocked || isTemp || pendingActions[`vote-${card.id}`]}
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
      )}
    </li>
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
  sortMode,
}: RetroColumnProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  // Deleting a card removes it and its votes for every participant, so it is
  // confirmed before it happens.
  const [cardPendingDelete, setCardPendingDelete] = useState<string | null>(
    null
  );

  const config = COLUMN_CONFIG[columnType];
  const sortedCards = sortCards(cards, sortMode);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const cardId = e.dataTransfer.getData("text/plain") || draggedCardId;
    if (isLocked || !cardId) {
      return;
    }
    if (!cards.some((c) => c.id === cardId)) {
      onMoveCard(cardId, columnType);
    }
    setDraggedCardId(null);
  };

  return (
    <section
      aria-labelledby={`column-${columnType}-heading`}
      className={cn(
        // Each lane is tinted with its column colour, so the white cards
        // stand out and the three columns read apart at a glance.
        "relative flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border-2 border-border bg-background transition-colors",
        isDragOver && !isLocked && "bg-primary/10 ring-2 ring-primary"
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
      <div
        aria-hidden="true"
        className={cn("pointer-events-none absolute inset-0", config.lane)}
      />
      <div className="relative flex items-center gap-2 px-3 pt-3 pb-2 max-md:sr-only">
        <h2
          className={cn(
            "min-w-0 truncate rounded-full px-3 py-1 font-bold text-sm",
            config.pill
          )}
          id={`column-${columnType}-heading`}
        >
          {config.title}
        </h2>
        <span className="ml-auto font-bold text-muted-foreground text-sm tabular-nums">
          {cards.length}
          <span className="sr-only"> cards</span>
        </span>
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-2.5 pb-3 max-md:pt-2.5">
        {!isLocked && (
          <div className="max-md:hidden">
            <CardComposer columnType={columnType} onAddCard={onAddCard} />
          </div>
        )}

        {sortedCards.length === 0 && (
          <p className="px-3 py-8 text-center text-muted-foreground text-sm">
            {isLocked ? "No cards." : config.prompt}
          </p>
        )}

        <ul className="flex flex-col gap-2.5">
          {sortedCards.map((card) => (
            <CardItem
              card={card}
              columnType={columnType}
              currentUserId={currentUserId}
              draggedCardId={draggedCardId}
              hasVoted={myVotes.has(card.id)}
              isLocked={isLocked}
              key={card.id}
              onDelete={() => setCardPendingDelete(card.id)}
              onEditCard={onEditCard}
              onMoveCard={onMoveCard}
              onVoteCard={onVoteCard}
              pendingActions={pendingActions}
              setDraggedCardId={setDraggedCardId}
            />
          ))}
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
