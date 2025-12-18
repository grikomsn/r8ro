"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { useEffect, useState } from "react"

export default function AuthCodeErrorPage() {
  const [errorInfo, setErrorInfo] = useState<{
    error: string
    description: string
  } | null>(null)

  useEffect(() => {
    const hash = window.location.hash.substring(1)
    const params = new URLSearchParams(hash)

    setErrorInfo({
      error: params.get("error") || "unknown_error",
      description: params.get("error_description")?.replace(/\+/g, " ") || "Unknown error occurred",
    })
  }, [])

  const isIdentityExists = errorInfo?.error === "identity_already_exists"

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6 rounded-xl border-2 border-border bg-card p-8 text-center shadow-lg">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground">
            {isIdentityExists ? "Account Already Linked" : "Authentication Error"}
          </h1>
          <p className="text-muted-foreground">
            {isIdentityExists
              ? "This GitHub account is already linked to another user account."
              : errorInfo?.description || "There was an error linking your GitHub account."}
          </p>
        </div>

        {isIdentityExists ? (
          <div className="space-y-4 pt-4">
            <p className="text-sm text-muted-foreground">
              You can sign in with this GitHub account instead. Your current anonymous data will be migrated to the
              GitHub-linked account.
            </p>
            <Button asChild className="w-full" size="lg">
              <Link href="/auth/signin-github">Sign In with GitHub</Link>
            </Button>
            <Button asChild variant="outline" className="w-full bg-transparent" size="lg">
              <Link href="/">Continue as Guest</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-3 pt-4">
            <Button asChild className="w-full" size="lg">
              <Link href="/">Return to Home</Link>
            </Button>
            <p className="text-xs text-muted-foreground">You can try linking your account again from your profile.</p>
          </div>
        )}
      </div>
    </div>
  )
}
