import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get("code")
  // if "next" is in param, use it as the redirect URL
  let next = searchParams.get("next") ?? "/"

  // Ensure next is a relative URL for security
  if (!next.startsWith("/")) {
    next = "/"
  }

  console.log("[v0] Auth callback received, code:", code ? "present" : "missing")

  if (code) {
    const supabase = await createServerClient()

    const { data: beforeSession } = await supabase.auth.getSession()
    const beforeUserId = beforeSession.session?.user.id
    console.log("[v0] Before exchange - user ID:", beforeUserId)

    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      const { data: afterSession } = await supabase.auth.getSession()
      const afterUserId = afterSession.session?.user.id
      const afterUser = afterSession.session?.user

      console.log("[v0] After exchange - user ID:", afterUserId)
      console.log("[v0] After exchange - is_anonymous:", afterUser?.is_anonymous)

      if (beforeUserId && afterUserId && beforeUserId !== afterUserId) {
        console.log("[v0] User ID changed! Migrating data from", beforeUserId, "to", afterUserId)

        try {
          // Create admin client with service role key to bypass RLS
          const supabaseAdmin = createAdminClient()

          // Migrate retro_boards
          const { error: boardsError } = await supabaseAdmin
            .from("retro_boards")
            .update({ author_id: afterUserId })
            .eq("author_id", beforeUserId)

          if (boardsError) {
            console.error("[v0] Failed to migrate boards:", boardsError)
          } else {
            console.log("[v0] Successfully migrated boards")
          }

          // Migrate retro_cards
          const { error: cardsError } = await supabaseAdmin
            .from("retro_cards")
            .update({ author_id: afterUserId })
            .eq("author_id", beforeUserId)

          if (cardsError) {
            console.error("[v0] Failed to migrate cards:", cardsError)
          } else {
            console.log("[v0] Successfully migrated cards")
          }

          // Migrate retro_participants
          const { error: participantsError } = await supabaseAdmin
            .from("retro_participants")
            .update({ user_id: afterUserId })
            .eq("user_id", beforeUserId)

          if (participantsError) {
            console.error("[v0] Failed to migrate participants:", participantsError)
          } else {
            console.log("[v0] Successfully migrated participants")
          }

          // Delete orphaned anonymous user using admin client
          const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(beforeUserId)

          if (deleteError) {
            console.error("[v0] Failed to delete orphaned user:", deleteError)
          } else {
            console.log("[v0] Successfully deleted orphaned anonymous user")
          }
        } catch (migrationError) {
          console.error("[v0] Data migration failed:", migrationError)
        }
      }

      const appUrl = process.env.NEXT_PUBLIC_APP_URL
      const forwardedHost = request.headers.get("x-forwarded-host")
      const forwardedProto = request.headers.get("x-forwarded-proto") || "https"

      let redirectUrl: string

      if (appUrl) {
        // Use configured app URL (production)
        redirectUrl = `${appUrl}${next}`
        console.log("[v0] Redirecting to configured app URL:", redirectUrl)
      } else if (forwardedHost) {
        // Running on Vercel or behind a proxy
        redirectUrl = `${forwardedProto}://${forwardedHost}${next}`
        console.log("[v0] Redirecting to forwarded host:", redirectUrl)
      } else {
        // Local development - use request origin
        const { origin } = new URL(request.url)
        redirectUrl = `${origin}${next}`
        console.log("[v0] Redirecting to local origin:", redirectUrl)
      }

      return NextResponse.redirect(redirectUrl)
    } else {
      console.error("[v0] Failed to exchange code for session:", error)
    }
  }

  // Return the user to an error page with instructions
  const { origin } = new URL(request.url)
  const errorUrl = process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL}/auth/auth-code-error`
    : `${origin}/auth/auth-code-error`

  console.log("[v0] Redirecting to error page:", errorUrl)
  return NextResponse.redirect(errorUrl)
}
