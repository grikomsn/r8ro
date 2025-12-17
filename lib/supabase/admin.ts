import { createClient } from "@supabase/supabase-js"

/**
 * Creates a Supabase admin client with service role key.
 * This bypasses RLS and should only be used in secure server-side contexts.
 * DO NOT expose this client to the browser.
 */
export function createAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
