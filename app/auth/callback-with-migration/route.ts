import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { cookies } from "next/headers"

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const next = searchParams.get("next") ?? "/"

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/auth-code-error`)
  }

  const supabase = await createServerClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    console.error("Failed to exchange code for session:", error)
    return NextResponse.redirect(`${origin}/auth/auth-code-error`)
  }

  // Get the anonymous user ID from cookie
  const cookieStore = await cookies()
  const anonUserId = cookieStore.get("anon_user_id")?.value

  if (anonUserId) {
    // Get the current authenticated user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user && user.id !== anonUserId) {
      // Migrate data from anonymous user to GitHub-linked account
      const admin = createAdminClient()

      await Promise.all([
        admin.from("retro_boards").update({ author_id: user.id }).eq("author_id", anonUserId),
        admin.from("retro_cards").update({ author_id: user.id }).eq("author_id", anonUserId),
        admin.from("retro_participants").update({ user_id: user.id }).eq("user_id", anonUserId),
      ])

      // Clean up orphaned anonymous user
      await admin.auth.admin.deleteUser(anonUserId).catch(() => {
        // Ignore deletion errors
      })
    }

    // Clear the cookie
    const response = NextResponse.redirect(`${origin}${next}`)
    response.cookies.delete("anon_user_id")
    return response
  }

  const redirectUrl = process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}${next}` : `${origin}${next}`
  return NextResponse.redirect(redirectUrl)
}
