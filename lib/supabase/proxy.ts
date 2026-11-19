/** biome-ignore-all lint/complexity/noForEach: we need to use request.cookies.set to set the cookies */

import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // Refreshes an expiring session so that server code sees a valid one.
  // getClaims verifies the token locally when the project uses asymmetric
  // signing keys, so most requests no longer wait on a round trip to the
  // auth server; with a shared secret it falls back to getUser.
  await supabase.auth.getClaims();

  return supabaseResponse;
}
