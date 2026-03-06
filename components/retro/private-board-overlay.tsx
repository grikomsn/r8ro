"use client";

import { Lock } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function PrivateBoardOverlay() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary p-4">
      <Card className="w-full max-w-md border-4 border-foreground shadow-lg">
        <CardHeader className="border-foreground border-b-4 bg-muted">
          <CardTitle className="flex items-center gap-3 font-black text-2xl uppercase">
            <Lock className="h-8 w-8" />
            Private Board
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <p className="mb-6">
            This retro board is currently set to private. Only the session
            author can view and access it.
          </p>
          <Button
            asChild
            className="w-full border-4 border-foreground bg-primary py-6 font-black text-lg uppercase shadow-md transition-[box-shadow,filter] hover:shadow-lg hover:brightness-105"
          >
            <Link href="/">Go Back Home</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
