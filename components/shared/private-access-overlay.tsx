"use client";

import { Lock } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface PrivateAccessOverlayProps {
  description: string;
  homeHref: string;
  title: string;
}

export function PrivateAccessOverlay({
  title,
  description,
  homeHref,
}: PrivateAccessOverlayProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary p-4">
      <Card className="w-full max-w-md overflow-hidden rounded-2xl border-2 border-border shadow-lg">
        <CardHeader className="rounded-none border-border border-b-2 bg-muted">
          <CardTitle className="flex items-center gap-3 font-black text-2xl uppercase">
            <Lock className="h-8 w-8" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <p className="mb-6">{description}</p>
          <Button
            asChild
            className="w-full rounded-xl border-2 border-border bg-primary py-6 font-black text-lg uppercase shadow-md transition-[box-shadow,filter] hover:shadow-lg hover:brightness-105"
          >
            <Link href={homeHref}>Go Back Home</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
