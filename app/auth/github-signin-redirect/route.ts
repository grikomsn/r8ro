import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

export async function GET(request: Request) {
  const { origin } = new URL(request.url)
  const supabase = await createServerClient()

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || origin

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "github",
    options: {
      redirectTo: `${appUrl}/auth/callback-with-migration`,
    },
  })

  if (error) {
    return NextResponse.redirect(`${origin}/auth/auth-code-error`)
  }

  return NextResponse.redirect(data.url)
}
