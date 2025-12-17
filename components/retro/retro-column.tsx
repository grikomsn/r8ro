"use client"

import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"
import type { RetroCard, ColumnType } from "@/lib/types"
import { Plus, ThumbsUp, Trash2, X, GripVertical, Pencil, Check, Lock } from "lucide-react"

interface RetroColumnProps {
  title: string
  columnType: ColumnType
  cards: RetroCard[]
  onAddCard: (columnType: ColumnType, content: string) => void
  onVoteCard: (cardId: string, currentVotes: number) => void
  onDeleteCard: (cardId: string) => void
  onEditCard: (cardId: string, newContent: string) => void
  onMoveCard: (cardId: string, newColumnType: ColumnType) => void
  currentUserId: string
  bgColor: string
  draggedCard: RetroCard | null
  setDraggedCard: (card: RetroCard | null) => void
  isLocked: boolean
}

const columnColorConfig: Record<ColumnType, { bg: string; text: string }> = {
  went_well: { bg: "bg-green-600", text: "text-white" },
  to_improve: { bg: "bg-red-600", text: "text-white" },
  action_items: { bg: "bg-blue-600", text: "text-white" },
}

export function RetroColumn({
  title,
  columnType,
  cards,
  onAddCard,
  onVoteCard,
  onDeleteCard,
  onEditCard,
  onMoveCard,
  currentUserId,
  bgColor,
  draggedCard,
  setDraggedCard,
  isLocked,
}: RetroColumnProps) {
  const [isAdding, setIsAdding] = useState(false)
  const [newCardContent, setNewCardContent] = useState("")
  const [editingCardId, setEditingCardId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState("")
  const [isDragOver, setIsDragOver] = useState(false)

  // Handler functions
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter") {
      handleSubmit()
    }
  }

  const handleSubmit = () => {
    if (newCardContent.trim()) {
      onAddCard(columnType, newCardContent)
      setIsAdding(false)
      setNewCardContent("")
    }
  }

  const handleDragEnd = () => {
    setDraggedCard(null)
  }

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      saveEdit()
    }
  }

  const saveEdit = () => {
    if (editingCardId && editContent.trim()) {
      onEditCard(editingCardId, editContent)
      setEditingCardId(null)
      setEditContent("")
    }
  }

  const cancelEdit = () => {
    setEditingCardId(null)
    setEditContent("")
  }

  const startEditing = (card: RetroCard) => {
    setEditingCardId(card.id)
    setEditContent(card.content)
  }

  const handleDragStart = (e: React.DragEvent, card: RetroCard) => {
    if (isLocked) {
      e.preventDefault()
      return
    }
    setDraggedCard(card)
    e.dataTransfer.effectAllowed = "move"
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    if (isLocked) return
    if (draggedCard && draggedCard.column_type !== columnType) {
      onMoveCard(draggedCard.id, columnType)
    }
    setDraggedCard(null)
  }

  // Sort cards by votes (highest first)
  const sortedCards = [...cards].sort((a, b) => b.votes - a.votes)

  const colors = columnColorConfig[columnType]

  return (
    <div className="flex flex-1 min-w-0 flex-col h-full" role="region" aria-label={`${title} column`}>
      {/* Column Header - Using design system colors */}
      <div className={`border-2 border-b-0 border-border ${colors.bg} p-4 shadow-sm rounded-t-xl`}>
        <div className="flex items-center justify-between">
          <h2 className={`text-lg font-black uppercase ${colors.text}`} id={`column-${columnType}-heading`}>
            {title}
          </h2>
          <div className="flex items-center gap-2">
            {isLocked && <Lock className={`h-4 w-4 ${colors.text} opacity-70`} aria-hidden="true" />}
            <span
              className="border border-border bg-background px-2 py-1 text-sm font-bold text-foreground rounded-md"
              aria-label={`${cards.length} cards`}
            >
              {cards.length}
            </span>
          </div>
        </div>
      </div>

      {/* Cards Container */}
      <div
        className={`flex-1 border-2 border-t-0 border-border bg-background p-4 shadow-sm overflow-auto transition-colors rounded-b-xl ${
          isDragOver && !isLocked ? "bg-muted" : ""
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        aria-labelledby={`column-${columnType}-heading`}
        role="list"
      >
        {isLocked ? (
          <div
            className="mb-3 flex items-center justify-center gap-2 border-2 border-dashed border-border/30 p-4 text-sm text-muted-foreground rounded-lg"
            role="status"
          >
            <Lock className="h-4 w-4" aria-hidden="true" />
            Board is locked
          </div>
        ) : isAdding ? (
          <div
            className="mb-3 border-2 border-border bg-muted p-3 shadow-sm rounded-lg"
            role="form"
            aria-label="Add new card"
          >
            <Textarea
              value={newCardContent}
              onChange={(e) => setNewCardContent(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your thought..."
              className="mb-2 min-h-[80px] border border-border shadow-sm rounded-lg"
              autoFocus
              aria-label="Card content"
            />
            <div className="flex gap-2">
              <Button
                onClick={handleSubmit}
                className="flex-1 h-10 border border-border bg-foreground font-bold text-background rounded-lg"
              >
                Add
              </Button>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsAdding(false)
                        setNewCardContent("")
                      }}
                      className="h-10 w-10 p-0 border border-border rounded-lg"
                      aria-label="Cancel"
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
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
            variant="outline"
            onClick={() => setIsAdding(true)}
            className="mb-3 w-full h-12 border-2 border-dashed border-border/50 font-bold transition-all hover:border-border hover:bg-muted rounded-lg"
            aria-label={`Add card to ${title}`}
          >
            <Plus className="mr-2 h-5 w-5" aria-hidden="true" />
            Add Card
          </Button>
        )}

        {/* Cards List */}
        <div className="space-y-3" role="listitem">
          {sortedCards.map((card) => (
            <article
              key={card.id}
              draggable={!isLocked}
              onDragStart={(e) => handleDragStart(e, card)}
              onDragEnd={handleDragEnd}
              className={`group border-2 border-border bg-background p-3 shadow-sm transition-all hover:shadow-md rounded-xl ${
                isLocked ? "cursor-default" : "cursor-grab active:cursor-grabbing"
              } ${draggedCard?.id === card.id ? "opacity-50" : ""}`}
              aria-label={`Card by ${card.author_name}: ${card.content}`}
            >
              <div className="flex items-start gap-2 mb-2">
                {!isLocked && (
                  <GripVertical className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" aria-hidden="true" />
                )}
                <div className="flex-1">
                  {editingCardId === card.id && !isLocked ? (
                    <div className="space-y-2" role="form" aria-label="Edit card">
                      <Input
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        onKeyDown={handleEditKeyDown}
                        className="border border-border rounded-lg"
                        autoFocus
                        aria-label="Edit card content"
                      />
                      <div className="flex gap-2">
                        <Button
                          onClick={saveEdit}
                          className="h-8 flex-1 border border-border bg-foreground text-xs font-bold text-background rounded-lg"
                        >
                          <Check className="mr-1 h-3 w-3" aria-hidden="true" />
                          Save
                        </Button>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                onClick={cancelEdit}
                                className="h-8 border border-border bg-transparent rounded-lg"
                                aria-label="Cancel editing"
                              >
                                <X className="h-3 w-3" aria-hidden="true" />
                                <span className="sr-only">Cancel editing</span>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Cancel</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </div>
                  ) : (
                    <p className={`whitespace-pre-wrap text-sm ${isLocked ? "pl-0" : ""}`}>{card.content}</p>
                  )}
                </div>
              </div>
              <div className={`flex items-center justify-between ${isLocked ? "pl-0" : "pl-7"}`}>
                <span className="text-xs text-muted-foreground">by {card.author_name}</span>
                <div className="flex items-center gap-1" role="group" aria-label="Card actions">
                  {!isLocked && card.author_id === currentUserId && editingCardId !== card.id && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            onClick={() => startEditing(card)}
                            className="h-8 w-8 p-0 opacity-0 transition-opacity group-hover:opacity-100 rounded-lg"
                            aria-label="Edit card"
                          >
                            <Pencil className="h-4 w-4" aria-hidden="true" />
                            <span className="sr-only">Edit card</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Edit</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                  {!isLocked && card.author_id === currentUserId && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            onClick={() => onDeleteCard(card.id)}
                            className="h-8 w-8 p-0 opacity-0 transition-opacity group-hover:opacity-100 rounded-lg"
                            aria-label="Delete card"
                          >
                            <Trash2 className="h-4 w-4 text-primary" aria-hidden="true" />
                            <span className="sr-only">Delete card</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Delete</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          onClick={() => onVoteCard(card.id, card.votes)}
                          className="h-8 px-2 border border-border font-bold shadow-sm transition-all hover:bg-secondary rounded-lg"
                          aria-label={`Vote for this card. Current votes: ${card.votes}`}
                        >
                          <ThumbsUp className="mr-1 h-3 w-3" aria-hidden="true" />
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
  )
}
