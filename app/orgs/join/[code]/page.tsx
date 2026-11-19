import type { Metadata } from "next";
import JoinOrgClient from "./JoinOrgClient";

export const metadata: Metadata = {
  title: "Join an organization",
  robots: { index: false, follow: false },
  // The invite code is in the path; never send it to other sites.
  referrer: "no-referrer",
};

export default async function JoinOrganizationPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <JoinOrgClient code={code} />;
}
