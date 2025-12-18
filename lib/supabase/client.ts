"use client"

import { createBrowserClient } from "@supabase/ssr"

let clientInstance: ReturnType<typeof createBrowserClient> | null = null

export function createClient() {
  if (!clientInstance) {
    clientInstance = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
  }
  return clientInstance
}

// Export a function to force clear session and recreate client
export function clearSessionAndRecreateClient() {
  if (typeof window !== "undefined") {
    const keys = Object.keys(localStorage)
    keys.forEach((key) => {
      if (key.startsWith("sb-") && key.includes("-auth-token")) {
        localStorage.removeItem(key)
      }
    })
  }
  clientInstance = null
  return createClient()
}
