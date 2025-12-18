import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/client"

export async function GET(request: Request) {
  const { origin } = new URL(request.url)

  // Store the current anonymous user ID before signing in
  const supabase = createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const anonUserId = session?.user?.id

  if (anonUserId) {
    // Store in a temporary cookie or localStorage for migration
    const response = NextResponse.redirect(`${origin}/auth/github-signin-redirect`)
    response.cookies.set("anon_user_id", anonUserId, {
      httpOnly: true,
      maxAge: 60 * 5, // 5 minutes
      path: "/",
    })
    return response
  }

  return NextResponse.redirect(`${origin}/auth/github-signin-redirect`)
}
