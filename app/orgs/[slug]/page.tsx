import type { Metadata } from "next";
import OrgPageClient from "./OrgPageClient";

// The name is not read here: organizations are visible to their members only,
// and a link preview must not reveal one.
export const metadata: Metadata = {
  title: "Organization",
  robots: { index: false, follow: false },
};

export default async function OrganizationPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <OrgPageClient slug={slug} />;
}
