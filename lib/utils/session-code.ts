// Session codes look like "swift-falcon-1234". People often paste the whole
// link instead of the code, so the join forms accept either.
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function parseSessionCode(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  let candidate = trimmed;

  if (trimmed.includes("/")) {
    try {
      const url = new URL(
        trimmed.includes("://") ? trimmed : `https://${trimmed}`
      );
      const segments = url.pathname.split("/").filter(Boolean);
      candidate = segments.at(-1) ?? "";
    } catch {
      candidate = trimmed.split("/").filter(Boolean).at(-1) ?? "";
    }
  }

  const slug = candidate.toLowerCase();
  return SLUG_PATTERN.test(slug) ? slug : null;
}
