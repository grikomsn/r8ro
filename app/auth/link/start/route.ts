import { NextResponse } from "next/server";
import {
  createSignedLinkSourceCookieValue,
  LINK_SOURCE_USER_COOKIE,
  LINK_SOURCE_USER_COOKIE_MAX_AGE_SECONDS,
} from "@/lib/auth/linking";
import { createServerClient } from "@/lib/supabase/server";

export async function POST() {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    if (!user.is_anonymous) {
      return NextResponse.json(
        { error: "Only guest accounts can link GitHub" },
        { status: 400 }
      );
    }

    const response = NextResponse.json({ success: true });
    response.cookies.set({
      name: LINK_SOURCE_USER_COOKIE,
      value: createSignedLinkSourceCookieValue(user.id),
      httpOnly: true,
      maxAge: LINK_SOURCE_USER_COOKIE_MAX_AGE_SECONDS,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });

    return response;
  } catch (error) {
    console.error("Failed to prepare GitHub account linking:", error);
    return NextResponse.json(
      { error: "Failed to prepare account linking" },
      { status: 500 }
    );
  }
}
