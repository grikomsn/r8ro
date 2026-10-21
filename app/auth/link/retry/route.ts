import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  clearPendingLinkCookie,
  setPendingLinkCookie,
} from "@/lib/auth/link-cookie";
import {
  getSafeLinkNextPath,
  LINK_SOURCE_USER_COOKIE,
  verifyAndExtractLinkSourceState,
} from "@/lib/auth/linking";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

/**
 * Retries the guest to GitHub account transfer.
 *
 * The OAuth callback already installed the GitHub session before it tried to
 * merge the guest account. If the merge failed, the signed source proof is
 * kept so this route can try again, instead of stranding the guest data.
 */
export async function POST(request: NextRequest) {
  const origin = request.nextUrl.origin;

  // Only accept a same origin submission.
  const requestOrigin = request.headers.get("origin");
  if (requestOrigin && requestOrigin !== origin) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const pending = verifyAndExtractLinkSourceState(
    request.cookies.get(LINK_SOURCE_USER_COOKIE)?.value
  );

  if (!pending) {
    return NextResponse.redirect(
      `${origin}/auth/auth-code-error?reason=source_expired`,
      303
    );
  }

  const supabase = await createServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user || user.is_anonymous) {
    return NextResponse.redirect(
      `${origin}/auth/auth-code-error?reason=source_unavailable`,
      303
    );
  }

  try {
    const { error: mergeError } = await createAdminClient().rpc(
      "merge_guest_account_into_current_user",
      {
        source_user_id: pending.sourceUserId,
        target_user_id: user.id,
      }
    );

    if (mergeError) {
      throw mergeError;
    }

    return clearPendingLinkCookie(
      NextResponse.redirect(
        `${origin}${getSafeLinkNextPath(pending.next)}`,
        303
      )
    );
  } catch (mergeError) {
    console.error("Account merge retry failed:", mergeError);
    return setPendingLinkCookie(
      NextResponse.redirect(
        `${origin}/auth/auth-code-error?reason=merge_pending`,
        303
      ),
      pending
    );
  }
}
