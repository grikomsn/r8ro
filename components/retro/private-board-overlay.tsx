"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Lock } from "lucide-react"

interface PrivateBoardOverlayProps {
  onGoHome: () => void
}

export function PrivateBoardOverlay({ onGoHome }: PrivateBoardOverlayProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary p-4">
      <Card className="w-full max-w-md border-4 border-foreground shadow-lg">
        <CardHeader className="border-b-4 border-foreground bg-muted">
          <CardTitle className="flex items-center gap-3 text-2xl font-black uppercase">
            <Lock className="h-8 w-8" />
            Private Board
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <p className="mb-6">
            This retro board is currently set to private. Only the session author can view and access it.
          </p>
          <Button
            onClick={onGoHome}
            className="w-full border-4 border-foreground bg-primary py-6 text-lg font-black uppercase shadow-md transition-all hover:shadow-lg hover:brightness-105"
          >
            Go Back Home
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
