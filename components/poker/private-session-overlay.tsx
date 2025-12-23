"use client";

import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface PrivateSessionOverlayProps {
  onGoHome: () => void;
}

export function PrivateSessionOverlay({
  onGoHome,
}: PrivateSessionOverlayProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary p-4">
      <Card className="w-full max-w-md rounded-2xl border-4 border-foreground shadow-lg">
        <CardHeader className="rounded-none border-foreground border-b-4 bg-muted">
          <CardTitle className="flex items-center gap-3 font-black text-2xl uppercase">
            <Lock className="h-8 w-8" />
            Private Session
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <p className="mb-6">
            This poker session is currently set to private. Only the session
            author can view and access it.
          </p>
          <Button
            className="w-full rounded-xl border-4 border-foreground bg-primary py-6 font-black text-lg uppercase shadow-md transition-all hover:shadow-lg hover:brightness-105"
            onClick={onGoHome}
          >
            Go Back Home
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
