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

  // Capture current user ID before exchange
  const { data: beforeSession } = await supabase.auth.getSession()
  const beforeUserId = beforeSession.session?.user.id

  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    console.error("Failed to exchange code for session:", error)
    return NextResponse.redirect(`${origin}/auth/auth-code-error`)
  }

  // Check if user ID changed (linking existing account)
  const { data: afterSession } = await supabase.auth.getSession()
  const afterUserId = afterSession.session?.user.id

  if (beforeUserId && afterUserId && beforeUserId !== afterUserId) {
    // Migrate data from anonymous user to linked account
    const admin = createAdminClient()

    await Promise.all([
      admin.from("retro_boards").update({ author_id: afterUserId }).eq("author_id", beforeUserId),
      admin.from("retro_cards").update({ author_id: afterUserId }).eq("author_id", beforeUserId),
      admin.from("retro_participants").update({ user_id: afterUserId }).eq("user_id", beforeUserId),
    ])

    // Clean up orphaned anonymous user
    await admin.auth.admin.deleteUser(beforeUserId).catch(() => {
      // Ignore deletion errors
    })
  }

  const redirectUrl = process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}${next}` : `${origin}${next}`

  return NextResponse.redirect(redirectUrl)
}
