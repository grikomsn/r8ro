import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  LINK_SOURCE_USER_COOKIE,
  verifyAndExtractLinkSourceUserId,
} from "@/lib/auth/linking";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

function getSafeNextPath(nextParam: string | null) {
  if (!nextParam?.startsWith("/")) {
    return "/";
  }

  return nextParam;
}

function clearPendingLinkCookie(response: NextResponse) {
  response.cookies.set({
    name: LINK_SOURCE_USER_COOKIE,
    value: "",
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}

async function redirectToGitHubSignInFallback(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  origin: string,
  next: string
) {
  const fallbackRedirect = new URL("/auth/callback", origin);
  fallbackRedirect.searchParams.set("mode", "signin-fallback");
  fallbackRedirect.searchParams.set("next", next);
  fallbackRedirect.searchParams.set("link", "github");

  const { data: oauthData, error: oauthError } =
    await supabase.auth.signInWithOAuth({
      provider: "github",
      options: {
        redirectTo: fallbackRedirect.toString(),
        skipBrowserRedirect: true,
      },
    });

  if (!oauthError && oauthData.url) {
    return NextResponse.redirect(oauthData.url);
  }

  console.error("Failed to fallback to GitHub sign-in:", oauthError);
  return null;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = getSafeNextPath(searchParams.get("next"));
  const isGitHubLinkFlow = searchParams.get("link") === "github";
  const attemptedFallbackSignIn =
    searchParams.get("mode") === "signin-fallback";
  const pendingSourceCookie = request.cookies.get(
    LINK_SOURCE_USER_COOKIE
  )?.value;
  const pendingSourceUserId =
    verifyAndExtractLinkSourceUserId(pendingSourceCookie);
  const hasPendingSourceCookie = !!pendingSourceCookie;

  if (hasPendingSourceCookie && !pendingSourceUserId) {
    console.error("Invalid account-link source cookie signature");
  }

  const supabase = await createServerClient();

  if (!code) {
    if (
      (isGitHubLinkFlow || hasPendingSourceCookie) &&
      !attemptedFallbackSignIn
    ) {
      const fallbackResponse = await redirectToGitHubSignInFallback(
        supabase,
        origin,
        next
      );
      if (fallbackResponse) {
        return fallbackResponse;
      }
    }

    return clearPendingLinkCookie(
      NextResponse.redirect(`${origin}/auth/auth-code-error`)
    );
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (!error) {
    if (pendingSourceUserId) {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        console.error("Failed to load user after auth callback:", userError);
        return clearPendingLinkCookie(
          NextResponse.redirect(`${origin}/auth/auth-code-error`)
        );
      }

      if (pendingSourceUserId !== user.id) {
        try {
          const adminClient = createAdminClient();
          const { error: mergeError } = await adminClient.rpc(
            "merge_guest_account_into_current_user",
            {
              source_user_id: pendingSourceUserId,
              target_user_id: user.id,
            }
          );

          if (mergeError) {
            console.error(
              "Failed to merge guest account after OAuth:",
              mergeError
            );
            return clearPendingLinkCookie(
              NextResponse.redirect(`${origin}/auth/auth-code-error`)
            );
          }
        } catch (mergeError) {
          console.error(
            "Failed to merge guest account after OAuth:",
            mergeError
          );
          return clearPendingLinkCookie(
            NextResponse.redirect(`${origin}/auth/auth-code-error`)
          );
        }
      }
    }

    const forwardedHost = request.headers.get("x-forwarded-host");
    const isLocalEnv = process.env.NODE_ENV === "development";

    const redirectResponse = isLocalEnv
      ? NextResponse.redirect(`${origin}${next}`)
      : forwardedHost
        ? NextResponse.redirect(`https://${forwardedHost}${next}`)
        : NextResponse.redirect(`${origin}${next}`);

    if (hasPendingSourceCookie) {
      return clearPendingLinkCookie(redirectResponse);
    }

    return redirectResponse;
  }

  if (error.code === "identity_already_exists" && !attemptedFallbackSignIn) {
    const fallbackResponse = await redirectToGitHubSignInFallback(
      supabase,
      origin,
      next
    );
    if (fallbackResponse) {
      return fallbackResponse;
    }
  }

  console.error("GitHub auth callback failed:", error);
  return clearPendingLinkCookie(
    NextResponse.redirect(`${origin}/auth/auth-code-error`)
  );
}
