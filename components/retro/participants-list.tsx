"use client"

import type { RetroParticipant } from "@/lib/types"
import { Users, Crown, X } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ParticipantsListProps {
  participants: RetroParticipant[]
  authorId: string
  onClose?: () => void
}

export function ParticipantsList({ participants, authorId, onClose }: ParticipantsListProps) {
  const onlineParticipants = participants.filter((p) => p.is_online)
  const offlineParticipants = participants.filter((p) => !p.is_online)

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b-2 border-border p-4">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          <h3 className="text-lg font-black uppercase">Participants</h3>
        </div>
        {onClose && (
          <Button variant="ghost" onClick={onClose} className="h-8 w-8 p-0 lg:hidden rounded-lg">
            <X className="h-5 w-5" />
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-auto p-4">
        {/* Online */}
        <div className="mb-4">
          <p className="mb-2 text-xs font-bold uppercase text-muted-foreground">Online ({onlineParticipants.length})</p>
          <div className="space-y-2">
            {onlineParticipants.map((participant) => (
              <div
                key={participant.id}
                className="flex items-center gap-2 border border-border bg-chart-4/20 px-3 py-2 rounded-lg"
              >
                <div className="h-2 w-2 rounded-full bg-chart-4" />
                <span className="flex-1 truncate text-sm font-semibold text-foreground">{participant.username}</span>
                {participant.user_id === authorId && <Crown className="h-4 w-4 text-amber-600 fill-amber-500" />}
              </div>
            ))}
          </div>
        </div>

        {/* Offline */}
        {offlineParticipants.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-bold uppercase text-muted-foreground">
              Offline ({offlineParticipants.length})
            </p>
            <div className="space-y-2">
              {offlineParticipants.map((participant) => (
                <div
                  key={participant.id}
                  className="flex items-center gap-2 border border-border/30 bg-muted px-3 py-2 opacity-60 rounded-lg"
                >
                  <div className="h-2 w-2 rounded-full bg-muted-foreground" />
                  <span className="flex-1 truncate text-sm font-semibold text-foreground">{participant.username}</span>
                  {participant.user_id === authorId && <Crown className="h-4 w-4 text-amber-600 fill-amber-500" />}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
