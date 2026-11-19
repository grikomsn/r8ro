import type { Metadata } from "next";
import AccountClientPage from "./client-page";

export const metadata: Metadata = {
  title: "Account",
  robots: { index: false, follow: false },
};

export default function AccountPage() {
  return <AccountClientPage />;
}
