"use client";

import type React from "react";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";

interface JoinModalProps {
  onJoin: (username: string) => void;
}

export function JoinModal({ onJoin }: JoinModalProps) {
  const { displayName, updateDisplayName, isInitialized } = useAuth();
  const [username, setUsername] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isInitialized && displayName) {
      setUsername(displayName);
    }
  }, [isInitialized, displayName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      return;
    }

    setIsSubmitting(true);

    if (username.trim() !== displayName) {
      await updateDisplayName(username.trim());
    }

    onJoin(username.trim());
    setIsSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4">
      <Card className="w-full max-w-md overflow-hidden rounded-2xl border-2 border-border shadow-lg">
        <CardHeader className="rounded-none border-border border-b-2 bg-primary py-5 text-primary-foreground">
          <CardTitle className="font-bold text-2xl uppercase">
            Join Session
          </CardTitle>
        </CardHeader>
        <CardContent className="p-8">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-3">
              <Label className="font-bold text-sm uppercase" htmlFor="username">
                Your Name
              </Label>
              <Input
                autoFocus
                className="h-12 rounded-xl border-2 border-border text-base shadow-sm"
                id="username"
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your name"
                required
                value={username}
              />
            </div>
            <Button
              className="w-full rounded-xl border-2 border-border bg-primary py-6 font-bold text-base uppercase shadow-md transition-all hover:shadow-lg"
              disabled={isSubmitting || !isInitialized}
              type="submit"
            >
              {isSubmitting ? "Joining..." : "Join Poker Session"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
