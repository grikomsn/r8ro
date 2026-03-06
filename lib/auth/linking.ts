import { createHmac, timingSafeEqual } from "node:crypto";

export const LINK_SOURCE_USER_COOKIE = "r8ro-link-source-user-id";
export const LINK_SOURCE_USER_COOKIE_MAX_AGE_SECONDS = 60 * 10;

function getLinkCookieSecret() {
  const secret =
    process.env.AUTH_LINK_COOKIE_SECRET ??
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!secret) {
    throw new Error(
      "AUTH_LINK_COOKIE_SECRET or SUPABASE_SERVICE_ROLE_KEY is required"
    );
  }

  return secret;
}

function signLinkSourceUserId(sourceUserId: string) {
  return createHmac("sha256", getLinkCookieSecret())
    .update(sourceUserId)
    .digest("hex");
}

export function createSignedLinkSourceCookieValue(sourceUserId: string) {
  const signature = signLinkSourceUserId(sourceUserId);
  return `${sourceUserId}.${signature}`;
}

export function verifyAndExtractLinkSourceUserId(
  cookieValue: string | undefined
) {
  if (!cookieValue) {
    return null;
  }

  const separatorIndex = cookieValue.lastIndexOf(".");
  if (separatorIndex <= 0 || separatorIndex >= cookieValue.length - 1) {
    return null;
  }

  const sourceUserId = cookieValue.slice(0, separatorIndex);
  const providedSignature = cookieValue.slice(separatorIndex + 1);
  const expectedSignature = signLinkSourceUserId(sourceUserId);

  const providedBuffer = Buffer.from(providedSignature, "utf8");
  const expectedBuffer = Buffer.from(expectedSignature, "utf8");

  if (providedBuffer.length !== expectedBuffer.length) {
    return null;
  }

  if (!timingSafeEqual(providedBuffer, expectedBuffer)) {
    return null;
  }

  return sourceUserId;
}
