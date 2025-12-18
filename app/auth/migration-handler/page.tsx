"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function MigrationHandler() {
  const router = useRouter()

  useEffect(() => {
    const migrationUserId = localStorage.getItem("pending_github_migration")

    if (migrationUserId) {
      localStorage.removeItem("pending_github_migration")
      const callbackUrl = `/auth/callback?migration_user_id=${migrationUserId}`
      router.replace(callbackUrl)
    } else {
      router.replace("/")
    }
  }, [router])

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-sm text-muted-foreground">Processing authentication...</p>
    </div>
  )
}
