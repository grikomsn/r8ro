import "server-only";

import type { NextResponse } from "next/server";
import {
  createSignedLinkSourceCookieValue,
  LINK_SOURCE_USER_COOKIE,
  LINK_SOURCE_USER_COOKIE_MAX_AGE_SECONDS,
  type LinkSourceState,
} from "@/lib/auth/linking";

/**
 * Clears the signed source cookie. Used once the guest data has been
 * transferred, or when there is nothing left to transfer.
 */
export function clearPendingLinkCookie(response: NextResponse) {
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

/**
 * Keeps the signed source cookie so the transfer can be retried. The cookie
 * is the only proof of which guest account the data belongs to, so it must
 * survive a failed merge.
 */
export function setPendingLinkCookie(
  response: NextResponse,
  state: LinkSourceState
) {
  response.cookies.set({
    name: LINK_SOURCE_USER_COOKIE,
    value: createSignedLinkSourceCookieValue(state),
    httpOnly: true,
    maxAge: LINK_SOURCE_USER_COOKIE_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}
