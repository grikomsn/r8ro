"use client";

import { Analytics as VercelAnalytics } from "@vercel/analytics/next";

// An invite code is a capability: anyone holding it can join the
// organization. Page views are reported with the code replaced.
const INVITE_PATH = /\/orgs\/join\/[^/?#]+/;

export function Analytics() {
  return (
    <VercelAnalytics
      beforeSend={(event) => ({
        ...event,
        url: event.url.replace(INVITE_PATH, "/orgs/join/[code]"),
      })}
    />
  );
}
