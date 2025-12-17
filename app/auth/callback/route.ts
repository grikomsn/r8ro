import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  // if "next" is in param, use it as the redirect URL
  let next = searchParams.get("next") ?? "/"

  // Ensure next is a relative URL for security
  if (!next.startsWith("/")) {
    next = "/"
  }

  if (code) {
    const supabase = await createServerClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      const forwardedHost = request.headers.get("x-forwarded-host")
      const forwardedProto = request.headers.get("x-forwarded-proto") || "https"

      if (forwardedHost) {
        // Running on Vercel or behind a proxy
        return NextResponse.redirect(`${forwardedProto}://${forwardedHost}${next}`)
      } else {
        // Local development
        return NextResponse.redirect(`${origin}${next}`)
      }
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}
