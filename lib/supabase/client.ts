import { createBrowserClient } from "@supabase/ssr"

// Synchronously clear potentially corrupted tokens BEFORE any Supabase code runs
if (typeof window !== "undefined") {
  try {
    const keys = Object.keys(localStorage)
    const authTokenKey = keys.find((key) => key.startsWith("sb-") && key.includes("-auth-token"))

    if (authTokenKey) {
      const tokenData = localStorage.getItem(authTokenKey)
      if (tokenData) {
        const parsed = JSON.parse(tokenData)
        const accessToken = parsed?.access_token

        if (accessToken) {
          // Decode JWT payload (base64) to check expiration
          const parts = accessToken.split(".")
          if (parts.length === 3) {
            const payload = JSON.parse(atob(parts[1]))
            const exp = payload.exp
            const now = Math.floor(Date.now() / 1000)

            // If token is expired or will expire in next 60 seconds, clear it
            if (exp && exp < now + 60) {
              keys.forEach((key) => {
                if (key.startsWith("sb-") && key.includes("-auth-token")) {
                  localStorage.removeItem(key)
                }
              })
            }
          }
        }
      }
    }
  } catch {
    // If any error parsing, clear tokens to be safe
    const keys = Object.keys(localStorage)
    keys.forEach((key) => {
      if (key.startsWith("sb-") && key.includes("-auth-token")) {
        localStorage.removeItem(key)
      }
    })
  }
}

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
