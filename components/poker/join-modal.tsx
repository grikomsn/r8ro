"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/hooks/use-auth"

interface JoinModalProps {
  onJoin: (username: string) => void
}

export function JoinModal({ onJoin }: JoinModalProps) {
  const { displayName, updateDisplayName, isInitialized } = useAuth()
  const [username, setUsername] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (isInitialized && displayName) {
      setUsername(displayName)
    }
  }, [isInitialized, displayName])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim()) return

    setIsSubmitting(true)

    if (username.trim() !== displayName) {
      await updateDisplayName(username.trim())
    }

    onJoin(username.trim())
    setIsSubmitting(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4">
      <Card className="w-full max-w-md border-2 border-border shadow-lg rounded-2xl overflow-hidden">
        <CardHeader className="border-b-2 border-border bg-primary text-primary-foreground rounded-none py-5">
          <CardTitle className="text-2xl font-bold uppercase">
            Join Session
          </CardTitle>
        </CardHeader>
        <CardContent className="p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-3">
              <Label htmlFor="username" className="text-sm font-bold uppercase">
                Your Name
              </Label>
              <Input
                id="username"
                placeholder="Enter your name"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="h-12 rounded-xl border-2 border-border text-base shadow-sm"
                autoFocus
                required
              />
            </div>
            <Button
              type="submit"
              disabled={isSubmitting || !isInitialized}
              className="w-full rounded-xl border-2 border-border bg-primary py-6 text-base font-bold uppercase shadow-md transition-all hover:shadow-lg"
            >
              {isSubmitting ? "Joining..." : "Join Poker Session"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

