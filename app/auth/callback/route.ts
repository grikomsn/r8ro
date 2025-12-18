import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const next = searchParams.get("next") ?? "/"

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/auth-code-error`)
  }

  const supabase = await createServerClient()

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

  if (exchangeError) {
    console.error("Failed to exchange code for session:", exchangeError)
    return NextResponse.redirect(`${origin}/auth/auth-code-error?error=${encodeURIComponent(exchangeError.message)}`)
  }

  const { data: afterSession } = await supabase.auth.getSession()
  const afterUserId = afterSession.session?.user.id
  const user = afterSession.session?.user

  if (afterUserId) {
    if (user && !user.is_anonymous) {
      const currentDisplayName = user.user_metadata?.display_name?.trim()
      const githubIdentity = user.identities?.find((identity) => identity.provider === "github")
      const githubUsername =
        githubIdentity?.identity_data?.user_name ||
        githubIdentity?.identity_data?.preferred_username ||
        githubIdentity?.identity_data?.name ||
        user.user_metadata?.user_name ||
        user.user_metadata?.preferred_username

      if (githubUsername && !currentDisplayName) {
        await supabase.auth.updateUser({
          data: { display_name: githubUsername },
        })
      }
    }

    const migrationUserId = searchParams.get("migration_user_id")

    if (migrationUserId && migrationUserId !== afterUserId) {
      const admin = createAdminClient()

      try {
        // Batch all migration queries with Promise.all for better performance
        const [boardsResult, cardsResult, participantsResult] = await Promise.all([
          admin.from("retro_boards").update({ author_id: afterUserId }).eq("author_id", migrationUserId).select("id"),
          admin.from("retro_cards").update({ author_id: afterUserId }).eq("author_id", migrationUserId).select("id"),
          admin.from("retro_participants").update({ user_id: afterUserId }).eq("user_id", migrationUserId).select("id"),
        ])

        // Check for errors in any of the migration operations
        if (boardsResult.error || cardsResult.error || participantsResult.error) {
          console.error("Migration error:", {
            boards: boardsResult.error,
            cards: cardsResult.error,
            participants: participantsResult.error,
          })

          // Attempt rollback - restore original author_id
          await Promise.all([
            admin.from("retro_boards").update({ author_id: migrationUserId }).eq("author_id", afterUserId),
            admin.from("retro_cards").update({ author_id: migrationUserId }).eq("author_id", afterUserId),
            admin.from("retro_participants").update({ user_id: migrationUserId }).eq("user_id", afterUserId),
          ])

          return NextResponse.redirect(
            `${origin}/auth/auth-code-error?error=${encodeURIComponent("Failed to migrate data")}`,
          )
        }

        // Only delete the old user if migration succeeded
        const { error: deleteError } = await admin.auth.admin.deleteUser(migrationUserId)
        if (deleteError) {
          console.warn("Failed to delete old anonymous user:", deleteError)
          // Don't fail the whole operation if cleanup fails
        }
      } catch (error) {
        console.error("Unexpected migration error:", error)
        return NextResponse.redirect(
          `${origin}/auth/auth-code-error?error=${encodeURIComponent("Unexpected error during migration")}`,
        )
      }
    }
  }

  const redirectUrl = process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}${next}` : `${origin}${next}`

  return NextResponse.redirect(redirectUrl)
}
