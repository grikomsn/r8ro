import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * A server-side client with no session at all. It sees exactly what a
 * signed-out visitor sees, so whatever it reads is safe to put in a response
 * that is cached and shared, such as an Open Graph image.
 */
export function createPublicClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    }
  );
}
