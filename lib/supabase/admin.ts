import { createClient } from "@supabase/supabase-js";

interface AdminDatabase {
  public: {
    CompositeTypes: Record<string, never>;
    Enums: Record<string, never>;
    Functions: {
      merge_guest_account_into_current_user: {
        Args: {
          source_user_id: string;
          target_user_id: string;
        };
        Returns: null;
      };
    };
    Tables: Record<string, never>;
    Views: Record<string, never>;
  };
}

let adminClient: ReturnType<typeof createClient<AdminDatabase>> | null = null;

export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is required for account merge");
  }

  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for account merge");
  }

  if (!adminClient) {
    adminClient = createClient<AdminDatabase>(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return adminClient;
}
