import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { generateSlug, generateUserId, generateRandomUsername } from "@/lib/utils/slug"

export async function GET() {
  try {
    const supabase = await createClient()
    const slug = generateSlug()
    const authorId = generateUserId()
    const authorName = generateRandomUsername()

    // Create the board
    const { data: board, error: insertError } = await supabase
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
      .select("id")
      .single()

    if (insertError) throw insertError

    // Add creator as participant
    await supabase.from("retro_participants").insert({
      board_id: board.id,
      user_id: authorId,
      username: authorName,
      is_online: true,
    })

    // Redirect to the new board with user info in query params (client will store in localStorage)
    const url = new URL(
      `/retro/${slug}`,
      process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000",
    )
    url.searchParams.set("uid", authorId)
    url.searchParams.set("uname", authorName)

    return NextResponse.redirect(url)
  } catch (error) {
    console.error("Failed to create board:", error)
    return NextResponse.json({ error: "Failed to create board" }, { status: 500 })
  }
}
