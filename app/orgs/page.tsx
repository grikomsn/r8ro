import type { Metadata } from "next";
import OrganizationsClientPage from "./client-page";

export const metadata: Metadata = {
  title: "Organizations",
  robots: { index: false, follow: false },
};

export default function OrganizationsPage() {
  return <OrganizationsClientPage />;
}
