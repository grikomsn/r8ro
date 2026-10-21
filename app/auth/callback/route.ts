import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  clearPendingLinkCookie,
  setPendingLinkCookie,
} from "@/lib/auth/link-cookie";
import {
  getSafeLinkNextPath,
  LINK_SOURCE_USER_COOKIE,
  LINK_SOURCE_USER_COOKIE_MAX_AGE_SECONDS,
  type LinkSourceState,
  verifyAndExtractLinkSourceState,
} from "@/lib/auth/linking";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

async function redirectToGitHubSignInFallback(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  origin: string,
  linkState: LinkSourceState | null
) {
  const fallbackRedirect = new URL("/auth/callback", origin);

  const { data: oauthData, error: oauthError } =
    await supabase.auth.signInWithOAuth({
      provider: "github",
      options: {
        redirectTo: fallbackRedirect.toString(),
        skipBrowserRedirect: true,
      },
    });

  if (!oauthError && oauthData.url) {
    const response = NextResponse.redirect(oauthData.url);

    return linkState
      ? setPendingLinkCookie(response, {
          ...linkState,
          stage: "signin-fallback",
        })
      : response;
  }

  console.error("Failed to fallback to GitHub sign-in:", oauthError);
  return null;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const legacyNext = getSafeLinkNextPath(searchParams.get("next"));
  const isGitHubLinkFlow = searchParams.get("link") === "github";
  const pendingSourceCookie = request.cookies.get(
    LINK_SOURCE_USER_COOKIE
  )?.value;
  const pendingLinkState = verifyAndExtractLinkSourceState(pendingSourceCookie);
  const pendingSourceUserId = pendingLinkState?.sourceUserId;
  const hasPendingSourceCookie = !!pendingSourceCookie;
  const next = pendingLinkState?.next ?? legacyNext;
  const attemptedFallbackSignIn =
    pendingLinkState?.stage === "signin-fallback" ||
    searchParams.get("mode") === "signin-fallback";

  if (hasPendingSourceCookie && !pendingSourceUserId) {
    console.error("Invalid account-link source cookie signature");
  }

  const supabase = await createServerClient();

  if (!code) {
    if ((isGitHubLinkFlow || pendingLinkState) && !attemptedFallbackSignIn) {
      const fallbackResponse = await redirectToGitHubSignInFallback(
        supabase,
        origin,
        pendingLinkState
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
            // The signed source cookie is the only proof of which guest
            // account the data belongs to, so it is kept and the user is
            // offered a retry rather than losing the transfer.
            return setPendingLinkCookie(
              NextResponse.redirect(
                `${origin}/auth/auth-code-error?reason=merge_pending`
              ),
              pendingLinkState ?? {
                expiresAt:
                  Date.now() + LINK_SOURCE_USER_COOKIE_MAX_AGE_SECONDS * 1000,
                next,
                sourceUserId: pendingSourceUserId,
                stage: "link",
              }
            );
          }
        } catch (mergeError) {
          console.error(
            "Failed to merge guest account after OAuth:",
            mergeError
          );
          return setPendingLinkCookie(
            NextResponse.redirect(
              `${origin}/auth/auth-code-error?reason=merge_pending`
            ),
            pendingLinkState ?? {
              expiresAt:
                Date.now() + LINK_SOURCE_USER_COOKIE_MAX_AGE_SECONDS * 1000,
              next,
              sourceUserId: pendingSourceUserId,
              stage: "link",
            }
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
      pendingLinkState
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
