"use client"

import { useEffect, useState, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { Cursor } from "@/components/ui/cursor"

type CursorPosition = {
  id: string
  name: string
  x: number
  y: number
  color: string
}

function getUserColor(userId: string): string {
  const colors = ["#EF4444", "#F97316", "#EAB308", "#22C55E", "#06B6D4", "#3B82F6", "#8B5CF6", "#EC4899"]
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}

type LiveCursorsProps = {
  boardId: string
  currentUserId: string
  currentUserName: string
}

export function LiveCursors({ boardId, currentUserId, currentUserName }: LiveCursorsProps) {
  const [cursors, setCursors] = useState<Map<string, CursorPosition>>(new Map())
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null)
  const userIdRef = useRef(currentUserId)
  const userNameRef = useRef(currentUserName)
  const boardIdRef = useRef(boardId)

  userIdRef.current = currentUserId
  userNameRef.current = currentUserName
  boardIdRef.current = boardId

  useEffect(() => {
    const supabase = createClient()
    const odI = userIdRef.current
    const odName = userNameRef.current
    const odBoard = boardIdRef.current
    const userColor = getUserColor(odI)

    const channel = supabase.channel(`cursors-${odBoard}`, {
      config: { broadcast: { self: false } },
    })

    channel
      .on("broadcast", { event: "cursor" }, ({ payload }) => {
        if (payload.id !== userIdRef.current) {
          setCursors((prev) => {
            const next = new Map(prev)
            next.set(payload.id, payload as CursorPosition)
            return next
          })
        }
      })
      .on("broadcast", { event: "cursor_leave" }, ({ payload }) => {
        setCursors((prev) => {
          const next = new Map(prev)
          next.delete(payload.id)
          return next
        })
      })
      .subscribe()

    channelRef.current = channel

    let lastUpdate = 0
    const handleMouseMove = (e: MouseEvent) => {
      const now = Date.now()
      if (now - lastUpdate < 50) return // 20fps throttle
      lastUpdate = now

      if (!channelRef.current) return
      const x = (e.clientX / window.innerWidth) * 100
      const y = (e.clientY / window.innerHeight) * 100

      channelRef.current.send({
        type: "broadcast",
        event: "cursor",
        payload: {
          id: userIdRef.current,
          name: userNameRef.current,
          x,
          y,
          color: userColor,
        },
      })
    }

    window.addEventListener("mousemove", handleMouseMove)

    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
      channel.send({
        type: "broadcast",
        event: "cursor_leave",
        payload: { id: userIdRef.current },
      })
      supabase.removeChannel(channel)
    }
  }, []) // Empty dependency array - use refs for current values

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {Array.from(cursors.values()).map((cursor) => (
        <div
          key={cursor.id}
          className="absolute transition-all duration-75 ease-out"
          style={{ left: `${cursor.x}%`, top: `${cursor.y}%` }}
        >
          <Cursor color={cursor.color} name={cursor.name} />
        </div>
      ))}
    </div>
  )
}
