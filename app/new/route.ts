import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateRandomUsername, withSlugRetry } from "@/lib/utils/slug";

export async function GET() {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const authorId = user.id; // Use auth.uid()
    const authorName =
      user.user_metadata?.display_name || generateRandomUsername();

    // The slug space is finite, so a collision is retried with a new slug.
    const { data: board, error: insertError } = await withSlugRetry(
      async (slug) => {
        const { data, error } = await supabase
          .from("retro_boards")
          .insert({
            slug,
            title: "Untitled Retro",
            author_id: authorId,
            author_name: authorName,
            is_public: true,
            timer_running: false,
            timer_seconds: 300, // Default 5 minutes
          })
          .select("id, slug")
          .single();

        return { data, error };
      }
    );

    if (insertError || !board) {
      throw new Error(insertError?.message || "Failed to create board");
    }

    // Add creator as participant
    await supabase.from("retro_participants").insert({
      board_id: board.id,
      user_id: authorId,
      username: authorName,
      is_online: true,
    });

    // Redirect to the new board (no need for query params since auth handles user identity)
    const origin =
      process.env.NEXT_PUBLIC_APP_URL ??
      (process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000");
    const url = new URL(`/retro/${board.slug}`, origin);

    return NextResponse.redirect(url);
  } catch (error) {
    console.error("Failed to create board:", error);
    return NextResponse.json(
      { error: "Failed to create board" },
      { status: 500 }
    );
  }
}
