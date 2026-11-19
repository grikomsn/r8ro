// Site-wide identity used by metadata, the sitemap, robots and the Open Graph
// images. Copy that is shown on the page lives with the page.

/** Production origin. Canonical URLs and the sitemap always point here. */
export const SITE_URL = "https://r8ro.app";

export const SITE_NAME = "r8ro";

export const SITE_TAGLINE = "Realtime retrospectives and planning poker";

export const SITE_DESCRIPTION =
  "Free realtime retrospective boards and planning poker for agile teams. No sign-up: share a link and everyone joins with live cards, votes, presence and a shared timer.";

export const RETRO_LANDING = {
  title: "Free online retrospective board",
  description:
    "Run sprint retrospectives online for free. Collect what went well and what to improve, vote on what matters, and leave with action items. No sign-up; share a link and your team joins in realtime.",
  heading: "Run a sprint retro in minutes",
} as const;

export const POKER_LANDING = {
  title: "Free online planning poker",
  description:
    "Estimate stories with free online planning poker. Votes stay hidden until the host reveals them, with Fibonacci, T-shirt and 1–10 scales and a saved round history. No sign-up required.",
  heading: "Estimate as a team, without the bias",
} as const;

/**
 * Origin of the running deployment. Open Graph images are resolved against it,
 * so a preview deployment links to its own images rather than production's.
 */
export function getDeploymentUrl(): URL {
  if (process.env.VERCEL_ENV === "production") {
    return new URL(SITE_URL);
  }
  const vercelHost = process.env.VERCEL_BRANCH_URL ?? process.env.VERCEL_URL;
  if (vercelHost) {
    return new URL(`https://${vercelHost}`);
  }
  return new URL(process.env.NEXT_PUBLIC_APP_URL ?? SITE_URL);
}

/** True for a deployment that search engines should index. */
export function isIndexableDeployment(): boolean {
  return (process.env.VERCEL_ENV ?? "production") === "production";
}
