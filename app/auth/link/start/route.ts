import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  createSignedLinkSourceCookieValue,
  getSafeLinkNextPath,
  LINK_SOURCE_USER_COOKIE,
  LINK_SOURCE_USER_COOKIE_MAX_AGE_SECONDS,
} from "@/lib/auth/linking";
import { createServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    let next = "/";

    try {
      const body: unknown = await request.json();
      if (typeof body === "object" && body !== null && "next" in body) {
        next = getSafeLinkNextPath(body.next);
      }
    } catch {
      // Keep the default path when the optional JSON body is absent or invalid.
    }

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
      value: createSignedLinkSourceCookieValue({
        next,
        sourceUserId: user.id,
        stage: "link",
      }),
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
