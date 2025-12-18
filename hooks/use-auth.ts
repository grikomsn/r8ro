"use client"

import { createClient } from "@/lib/supabase/client"
import type { User } from "@supabase/supabase-js"
import { useCallback, useEffect, useState } from "react"

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

  useEffect(() => {
    const supabase = createClient()
    let mounted = true

    async function signInAnonymously() {
      const legacyName = typeof window !== "undefined" ? localStorage.getItem("retro_username") || "" : ""

      const { data, error } = await supabase.auth.signInAnonymously({
        options: {
          data: {
            display_name: legacyName,
          },
        },
      })

      if (error) {
        console.error("Anonymous sign-in failed:", error)
        if (mounted) {
          setState((prev) => ({ ...prev, isLoading: false, isInitialized: true }))
        }
        return
      }

      if (data.user && mounted) {
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

    async function initAuth() {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser()

      if (error || !user) {
        await signInAnonymously()
        return
      }

      const displayName = user.user_metadata?.display_name || ""
      const isAnonymous = user.is_anonymous || false

      if (mounted) {
        setState({
          user,
          userId: user.id,
          displayName,
          isLoading: false,
          isInitialized: true,
          isAnonymous,
        })
      }
    }

    initAuth()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return

      if (event === "SIGNED_OUT") {
        await signInAnonymously()
      } else if (session?.user) {
        const { data: userData } = await supabase.auth.getUser()
        const user = userData.user || session.user

        const isAnonymous = user.is_anonymous || false
        const displayName = user.user_metadata?.display_name || ""

        setState({
          user,
          userId: user.id,
          displayName,
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
    const supabase = createClient()
    const trimmedName = newName.trim()

    const { data, error } = await supabase.auth.updateUser({
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
      return { success: false, error: "User is not anonymous" }
    }

    const supabase = createClient()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin

    if (typeof window !== "undefined" && state.userId) {
      localStorage.setItem("pending_github_migration", state.userId)
    }

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "github",
      options: {
        redirectTo: `${appUrl}/auth/callback`,
        skipBrowserRedirect: false,
      },
    })

    if (error) {
      console.error("Failed to sign in with GitHub:", error)
      if (typeof window !== "undefined") {
        localStorage.removeItem("pending_github_migration")
      }
      return { success: false, error: error.message }
    }

    return { success: true, data }
  }, [state.isAnonymous, state.userId])

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
