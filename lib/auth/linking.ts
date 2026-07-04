import { createHmac, timingSafeEqual } from "node:crypto";

export const LINK_SOURCE_USER_COOKIE = "r8ro-link-source-user-id";
export const LINK_SOURCE_USER_COOKIE_MAX_AGE_SECONDS = 60 * 10;

export type LinkFlowStage = "link" | "signin-fallback";

export interface LinkSourceState {
  next: string;
  sourceUserId: string;
  stage: LinkFlowStage;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

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

function signLinkState(encodedState: string) {
  return createHmac("sha256", getLinkCookieSecret())
    .update(encodedState)
    .digest("hex");
}

export function getSafeLinkNextPath(value: unknown) {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//")
  ) {
    return "/";
  }

  return value;
}

export function createSignedLinkSourceCookieValue(state: LinkSourceState) {
  const encodedState = Buffer.from(JSON.stringify(state), "utf8").toString(
    "base64url"
  );
  const signature = signLinkState(encodedState);
  return `${encodedState}.${signature}`;
}

export function verifyAndExtractLinkSourceState(
  cookieValue: string | undefined
): LinkSourceState | null {
  if (!cookieValue) {
    return null;
  }

  const separatorIndex = cookieValue.lastIndexOf(".");
  if (separatorIndex <= 0 || separatorIndex >= cookieValue.length - 1) {
    return null;
  }

  const encodedState = cookieValue.slice(0, separatorIndex);
  const providedSignature = cookieValue.slice(separatorIndex + 1);
  const expectedSignature = signLinkState(encodedState);

  const providedBuffer = Buffer.from(providedSignature, "utf8");
  const expectedBuffer = Buffer.from(expectedSignature, "utf8");

  if (providedBuffer.length !== expectedBuffer.length) {
    return null;
  }

  if (!timingSafeEqual(providedBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(encodedState, "base64url").toString("utf8")
    );

    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("sourceUserId" in parsed) ||
      typeof parsed.sourceUserId !== "string" ||
      parsed.sourceUserId.length === 0 ||
      !("stage" in parsed) ||
      (parsed.stage !== "link" && parsed.stage !== "signin-fallback")
    ) {
      return null;
    }

    return {
      next: "next" in parsed ? getSafeLinkNextPath(parsed.next) : "/",
      sourceUserId: parsed.sourceUserId,
      stage: parsed.stage,
    };
  } catch {
    return UUID_PATTERN.test(encodedState)
      ? {
          next: "/",
          sourceUserId: encodedState,
          stage: "link",
        }
      : null;
  }
}
