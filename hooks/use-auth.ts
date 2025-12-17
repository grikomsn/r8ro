"use client"

import { createClient, clearSessionAndRecreateClient } from "@/lib/supabase/client"
import type { User } from "@supabase/supabase-js"
import { useCallback, useEffect, useState, useRef } from "react"

interface AuthState {
  user: User | null
  userId: string | null
  displayName: string
  isLoading: boolean
  isInitialized: boolean
  isAnonymous: boolean
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    userId: null,
    displayName: "",
    isLoading: true,
    isInitialized: false,
    isAnonymous: true,
  })

  const supabaseRef = useRef(createClient())
  const isRecoveringRef = useRef(false)

  useEffect(() => {
    let mounted = true

    async function signInAnonymously(client: ReturnType<typeof createClient>, isMounted: boolean) {
      const legacyName = typeof window !== "undefined" ? localStorage.getItem("retro_username") || "" : ""

      const { data, error } = await client.auth.signInAnonymously({
        options: {
          data: {
            display_name: legacyName,
          },
        },
      })

      if (error) {
        console.error("Anonymous sign-in failed:", error)
        if (isMounted) {
          setState((prev) => ({ ...prev, isLoading: false, isInitialized: true }))
        }
        return
      }

      if (data.user && isMounted) {
        if (typeof window !== "undefined") {
          localStorage.removeItem("retro_username")
          localStorage.removeItem("retro_user_id")
        }

        setState({
          user: data.user,
          userId: data.user.id,
          displayName: legacyName,
          isLoading: false,
          isInitialized: true,
          isAnonymous: true,
        })
      }
    }

    async function recoverFromCorruptedSession() {
      if (isRecoveringRef.current) return
      isRecoveringRef.current = true

      // Clear tokens and get fresh client
      const freshClient = clearSessionAndRecreateClient()
      supabaseRef.current = freshClient

      await signInAnonymously(freshClient, mounted)
      isRecoveringRef.current = false
    }

    async function initAuth() {
      const supabase = supabaseRef.current

      try {
        const { data: userData, error: userError } = await supabase.auth.getUser()

        if (userError) {
          const errorMsg = userError.message || ""
          if (errorMsg.includes("user_not_found") || errorMsg.includes("User from sub claim")) {
            await recoverFromCorruptedSession()
            return
          }
        }

        if (!userData?.user) {
          await signInAnonymously(supabase, mounted)
          return
        }

        const displayName = userData.user.user_metadata?.display_name || ""
        const isAnonymous = userData.user.is_anonymous || false

        if (mounted) {
          setState({
            user: userData.user,
            userId: userData.user.id,
            displayName,
            isLoading: false,
            isInitialized: true,
            isAnonymous,
          })
        }
      } catch (error: any) {
        const errorMessage = error?.message || String(error)
        if (errorMessage.includes("user_not_found") || errorMessage.includes("User from sub claim")) {
          await recoverFromCorruptedSession()
          return
        }

        console.error("Auth initialization error:", error)
        await recoverFromCorruptedSession()
      }
    }

    initAuth()

    const {
      data: { subscription },
    } = supabaseRef.current.auth.onAuthStateChange(async (event, session) => {
      if (!mounted || isRecoveringRef.current) return

      if (event === "SIGNED_OUT") {
        await signInAnonymously(supabaseRef.current, mounted)
      } else if (session?.user) {
        const isAnonymous = session.user.is_anonymous || false
        setState({
          user: session.user,
          userId: session.user.id,
          displayName: session.user.user_metadata?.display_name || "",
          isLoading: false,
          isInitialized: true,
          isAnonymous,
        })
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const updateDisplayName = useCallback(async (newName: string) => {
    const trimmedName = newName.trim()

    const { data, error } = await supabaseRef.current.auth.updateUser({
      data: { display_name: trimmedName },
    })

    if (error) {
      console.error("Failed to update display name:", error)
      return false
    }

    if (data.user) {
      setState((prev) => ({
        ...prev,
        displayName: trimmedName,
        user: data.user,
      }))
    }

    return true
  }, [])

  const linkGitHubIdentity = useCallback(async () => {
    if (!state.isAnonymous) {
      console.error("User is not anonymous")
      return { success: false, error: "User is not anonymous" }
    }

    try {
      let redirectUrl = "/auth/callback"

      if (typeof window !== "undefined") {
        // In production, use the current origin
        // In development, prefer NEXT_PUBLIC_APP_URL if set, otherwise use current origin
        const appUrl = process.env.NEXT_PUBLIC_APP_URL
        const origin = appUrl || window.location.origin
        redirectUrl = `${origin}/auth/callback`
      }

      const { data, error } = await supabaseRef.current.auth.linkIdentity({
        provider: "github",
        options: {
          redirectTo: redirectUrl,
        },
      })

      if (error) {
        console.error("Failed to link GitHub identity:", error)
        return { success: false, error: error.message }
      }

      return { success: true, data }
    } catch (error: any) {
      console.error("Failed to link GitHub identity:", error)
      return { success: false, error: error.message || "Failed to link GitHub account" }
    }
  }, [state.isAnonymous])

  return {
    user: state.user,
    userId: state.userId,
    displayName: state.displayName,
    isLoading: state.isLoading,
    isInitialized: state.isInitialized,
    isAnonymous: state.isAnonymous,
    updateDisplayName,
    linkGitHubIdentity,
  }
}
