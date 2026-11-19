"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { clearRecentBoards } from "@/lib/utils/recent-boards";
import { clearRecentPokerSessions } from "@/lib/utils/recent-poker-sessions";

interface SignOutButtonProps {
  className?: string;
  variant?: "outline" | "ghost";
}

/** Signs a linked account out of this browser. Not shown to guests. */
export function SignOutButton({
  className,
  variant = "outline",
}: SignOutButtonProps) {
  const router = useRouter();
  const { isAnonymous, signOut } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);

  if (isAnonymous) {
    return null;
  }

  const handleSignOut = async () => {
    setIsSigningOut(true);
    const result = await signOut();
    if (!result.success) {
      setIsSigningOut(false);
      toast.error("Could not sign out", { description: result.error });
      return;
    }
    clearRecentBoards();
    clearRecentPokerSessions();
    router.push("/");
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          className={cn("rounded-lg", className)}
          disabled={isSigningOut}
          size="sm"
          variant={variant}
        >
          <LogOut aria-hidden="true" className="mr-2 h-4 w-4" />
          {isSigningOut ? "Signing out…" : "Sign out"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Sign out of this browser?</AlertDialogTitle>
          <AlertDialogDescription>
            Your sessions and organizations stay with your GitHub account. This
            browser continues as a new guest until you sign in with GitHub
            again.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleSignOut}>
            Sign out
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
