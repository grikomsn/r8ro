"use client";

import {
  Check,
  ChevronLeft,
  ChevronRight,
  GripVertical,
  Lock,
  Pencil,
  Plus,
  ThumbsUp,
  Trash2,
  X,
} from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ColumnType, RetroCard } from "@/lib/types";

interface RetroColumnProps {
  cards: RetroCard[];
  columnType: ColumnType;
  draggedCard: RetroCard | null;
  isLocked: boolean;
  onAddCard: (columnType: ColumnType, content: string) => void;
  onDeleteCard: (cardId: string) => void;
  onEditCard: (cardId: string, newContent: string) => void;
  onMoveCard: (cardId: string, newColumnType: ColumnType) => void;
  onVoteCard: (cardId: string) => void;
  pendingActions?: Record<string, boolean>;
  setDraggedCard: (card: RetroCard | null) => void;
  title: string;
}

const columnColorConfig: Record<ColumnType, { bg: string; text: string }> = {
  went_well: { bg: "bg-chart-4", text: "text-foreground" },
  to_improve: { bg: "bg-destructive", text: "text-destructive-foreground" },
  action_items: { bg: "bg-chart-2", text: "text-primary-foreground" },
};

const columnOrder: ColumnType[] = ["went_well", "to_improve", "action_items"];

const columnLabels: Record<ColumnType, string> = {
  went_well: "Went Well",
  to_improve: "To Improve",
  action_items: "Action Items",
};

export function RetroColumn({
  title,
  columnType,
  cards,
  onAddCard,
  onVoteCard,
  onDeleteCard,
  onEditCard,
  onMoveCard,
  draggedCard,
  setDraggedCard,
  isLocked,
  pendingActions = {},
}: RetroColumnProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newCardContent, setNewCardContent] = useState("");
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const [voteAnnouncement, setVoteAnnouncement] = useState("");
  const voteAnnouncementInitialized = useRef(false);
  const previousTotalVotes = useRef(0);

  const columnIndex = columnOrder.indexOf(columnType);
  const previousColumn = columnIndex > 0 ? columnOrder[columnIndex - 1] : null;
  const nextColumn =
    columnIndex < columnOrder.length - 1 ? columnOrder[columnIndex + 1] : null;

  useEffect(() => {
    const totalVotes = cards.reduce((sum, card) => sum + card.votes, 0);

    if (!voteAnnouncementInitialized.current) {
      voteAnnouncementInitialized.current = true;
      previousTotalVotes.current = totalVotes;
      return;
    }

    if (totalVotes !== previousTotalVotes.current) {
      setVoteAnnouncement(
        `${title} column now has ${totalVotes} total vote${totalVotes === 1 ? "" : "s"}.`
      );
      previousTotalVotes.current = totalVotes;
    }
  }, [cards, title]);

  // Handler functions
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter") {
      handleSubmit();
    }
  };

  const handleSubmit = () => {
    if (newCardContent.trim()) {
      onAddCard(columnType, newCardContent);
      setIsAdding(false);
      setNewCardContent("");
    }
  };

  const handleDragEnd = () => {
    setDraggedCard(null);
  };

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      saveEdit();
    }
  };

  const saveEdit = () => {
    if (editingCardId && editContent.trim()) {
      onEditCard(editingCardId, editContent);
      setEditingCardId(null);
      setEditContent("");
    }
  };

  const cancelEdit = () => {
    setEditingCardId(null);
    setEditContent("");
  };

  const startEditing = (card: RetroCard) => {
    setEditingCardId(card.id);
    setEditContent(card.content);
  };

  const handleDragStart = (e: React.DragEvent, card: RetroCard) => {
    if (isLocked) {
      e.preventDefault();
      return;
    }
    setDraggedCard(card);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (isLocked) {
      return;
    }
    if (draggedCard && draggedCard.column_type !== columnType) {
      onMoveCard(draggedCard.id, columnType);
    }
    setDraggedCard(null);
  };

  // Sort cards by votes (highest first)
  const sortedCards = [...cards].sort((a, b) => b.votes - a.votes);

  const colors = columnColorConfig[columnType];

  return (
    <div
      aria-label={`${title} column`}
      className="flex h-full min-w-0 flex-1 flex-col"
      role="region"
    >
      {/* Column Header - Using design system colors */}
      <div
        className={`rounded-t-xl border-2 border-border border-b-0 ${colors.bg} p-3 shadow-sm md:p-4`}
      >
        <div className="flex items-center justify-between gap-2">
          <h2
            className={`font-black text-base uppercase ${colors.text} md:text-lg`}
            id={`column-${columnType}-heading`}
          >
            {title}
          </h2>
          <div className="flex items-center gap-2">
            {isLocked && (
              <Lock
                aria-hidden="true"
                className={`h-4 w-4 ${colors.text} opacity-70`}
              />
            )}
            <span className="rounded-md border border-border bg-background px-2 py-1 font-bold text-foreground text-xs md:text-sm">
              {cards.length}
            </span>
          </div>
        </div>
      </div>

      {/* Cards Container */}
      <div
        aria-labelledby={`column-${columnType}-heading`}
        className={`flex-1 overflow-auto overscroll-y-none rounded-b-xl border-2 border-border border-t-0 bg-background p-4 shadow-sm transition-colors ${
          isDragOver && !isLocked ? "bg-muted" : ""
        }`}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        role="region"
      >
        {isLocked ? (
          <div
            className="mb-3 flex items-center justify-center gap-2 rounded-lg border-2 border-border/30 border-dashed p-4 text-muted-foreground text-sm"
            role="status"
          >
            <Lock aria-hidden="true" className="h-4 w-4" />
            Board is locked
          </div>
        ) : isAdding ? (
          <div className="mb-3 rounded-lg border-2 border-border bg-muted p-3 shadow-sm">
            <Textarea
              aria-label="Card content"
              className="mb-2 min-h-[80px] rounded-lg border border-border shadow-sm"
              name="cardContent"
              onChange={(e) => setNewCardContent(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your thought…"
              value={newCardContent}
            />
            <div className="flex gap-2">
              <Button
                className="h-10 flex-1 rounded-lg border border-border bg-foreground font-bold text-background"
                disabled={pendingActions.addCard}
                onClick={handleSubmit}
              >
                Add
              </Button>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      aria-label="Cancel"
                      className="h-10 w-10 rounded-lg border border-border p-0"
                      onClick={() => {
                        setIsAdding(false);
                        setNewCardContent("");
                      }}
                      variant="outline"
                    >
                      <X aria-hidden="true" className="h-4 w-4" />
                      <span className="sr-only">Cancel</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Cancel</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        ) : (
          <Button
            aria-label={`Add card to ${title}`}
            className="mb-3 h-12 w-full rounded-lg border-2 border-border/50 border-dashed font-bold transition-[border-color,background-color] hover:border-border hover:bg-muted"
            disabled={pendingActions.addCard}
            onClick={() => setIsAdding(true)}
            variant="outline"
          >
            <Plus aria-hidden="true" className="mr-2 h-5 w-5" />
            Add Card
          </Button>
        )}

        {/* Cards List */}
        <p aria-live="polite" className="sr-only" role="status">
          {voteAnnouncement}
        </p>
        <div className="space-y-3" role="list">
          {sortedCards.map((card) => (
            <article
              aria-label={`Card by ${card.author_name}: ${card.content}`}
              className={`group relative overflow-hidden rounded-xl border-2 border-border bg-background p-3 shadow-sm transition-shadow hover:shadow-md ${
                isLocked
                  ? "cursor-default"
                  : "cursor-grab active:cursor-grabbing"
              } ${draggedCard?.id === card.id ? "opacity-50" : ""}`}
              draggable={!isLocked}
              key={card.id}
              onDragEnd={handleDragEnd}
              onDragStart={(e) => handleDragStart(e, card)}
              role="listitem"
            >
              <div className="mb-2 flex items-start gap-2">
                {!isLocked && (
                  <GripVertical
                    aria-hidden="true"
                    className="mt-0.5 h-5 w-5 flex-shrink-0 text-muted-foreground"
                  />
                )}
                <div className="min-w-0 flex-1">
                  {editingCardId === card.id && !isLocked ? (
                    <div className="space-y-2">
                      <Input
                        aria-label="Edit card content"
                        autoComplete="off"
                        className="rounded-lg border border-border"
                        name="editCardContent"
                        onChange={(e) => setEditContent(e.target.value)}
                        onKeyDown={handleEditKeyDown}
                        value={editContent}
                      />
                      <div className="flex gap-2">
                        <Button
                          className="h-8 flex-1 rounded-lg border border-border bg-foreground font-bold text-background text-xs"
                          onClick={saveEdit}
                        >
                          <Check aria-hidden="true" className="mr-1 h-3 w-3" />
                          Save
                        </Button>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                aria-label="Cancel editing"
                                className="h-8 rounded-lg border border-border bg-transparent"
                                onClick={cancelEdit}
                                variant="outline"
                              >
                                <X aria-hidden="true" className="h-3 w-3" />
                                <span className="sr-only">Cancel editing</span>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Cancel</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </div>
                  ) : (
                    <p
                      className={`break-words text-sm ${isLocked ? "pl-0" : ""}`}
                    >
                      {card.content}
                    </p>
                  )}
                </div>
              </div>
              <div
                className={`flex flex-col gap-2 ${isLocked ? "pl-0" : "pl-7"}`}
              >
                {/* Author line */}
                <span className="text-muted-foreground text-xs">
                  by {card.author_name}
                </span>
                {/* Action buttons row */}
                <div
                  aria-label="Card actions"
                  className="flex items-center justify-end gap-1"
                  role="group"
                >
                  {!isLocked && (
                    <>
                      {/* Move buttons - always visible on mobile */}
                      {previousColumn && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                aria-label={`Move card to ${columnLabels[previousColumn]}`}
                                className="h-7 w-7 rounded-lg p-0 md:h-8 md:w-8 md:opacity-0 md:transition-opacity md:group-hover:opacity-100 md:focus-visible:opacity-100"
                                disabled={pendingActions[`move-${card.id}`]}
                                onClick={() =>
                                  onMoveCard(card.id, previousColumn)
                                }
                                variant="ghost"
                              >
                                <ChevronLeft
                                  aria-hidden="true"
                                  className="h-3.5 w-3.5 md:h-4 md:w-4"
                                />
                                <span className="sr-only">
                                  Move to {columnLabels[previousColumn]}
                                </span>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              Move to {columnLabels[previousColumn]}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      {nextColumn && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                aria-label={`Move card to ${columnLabels[nextColumn]}`}
                                className="h-7 w-7 rounded-lg p-0 md:h-8 md:w-8 md:opacity-0 md:transition-opacity md:group-hover:opacity-100 md:focus-visible:opacity-100"
                                disabled={pendingActions[`move-${card.id}`]}
                                onClick={() => onMoveCard(card.id, nextColumn)}
                                variant="ghost"
                              >
                                <ChevronRight
                                  aria-hidden="true"
                                  className="h-3.5 w-3.5 md:h-4 md:w-4"
                                />
                                <span className="sr-only">
                                  Move to {columnLabels[nextColumn]}
                                </span>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              Move to {columnLabels[nextColumn]}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      {/* Edit button - always visible on mobile */}
                      {editingCardId !== card.id && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                aria-label="Edit card"
                                className="h-7 w-7 rounded-lg p-0 md:h-8 md:w-8 md:opacity-0 md:transition-opacity md:group-hover:opacity-100 md:focus-visible:opacity-100"
                                disabled={pendingActions[`edit-${card.id}`]}
                                onClick={() => startEditing(card)}
                                variant="ghost"
                              >
                                <Pencil
                                  aria-hidden="true"
                                  className="h-3.5 w-3.5 md:h-4 md:w-4"
                                />
                                <span className="sr-only">Edit card</span>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Edit</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      {/* Delete button - always visible on mobile */}
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              aria-label="Delete card"
                              className="h-7 w-7 rounded-lg p-0 md:h-8 md:w-8 md:opacity-0 md:transition-opacity md:group-hover:opacity-100 md:focus-visible:opacity-100"
                              disabled={pendingActions[`delete-${card.id}`]}
                              onClick={() => onDeleteCard(card.id)}
                              variant="ghost"
                            >
                              <Trash2
                                aria-hidden="true"
                                className="h-3.5 w-3.5 text-primary md:h-4 md:w-4"
                              />
                              <span className="sr-only">Delete card</span>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Delete</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </>
                  )}
                  {/* Vote button - always visible on all screen sizes */}
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          aria-label={`Vote for this card. Current votes: ${card.votes}`}
                          className="ml-1 h-7 flex-shrink-0 rounded-lg border border-border px-2 font-bold text-sm shadow-sm transition-[background-color,box-shadow] hover:bg-secondary md:h-8"
                          disabled={
                            isLocked || pendingActions[`vote-${card.id}`]
                          }
                          onClick={() => onVoteCard(card.id)}
                          variant="outline"
                        >
                          <ThumbsUp
                            aria-hidden="true"
                            className="mr-1 h-3 w-3"
                          />
                          {card.votes}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Vote</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
