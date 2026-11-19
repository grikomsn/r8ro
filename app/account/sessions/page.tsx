import type { Metadata } from "next";
import MySessionsClientPage from "./client-page";

export const metadata: Metadata = {
  title: "My sessions",
  robots: { index: false, follow: false },
};

export default function MySessionsPage() {
  return <MySessionsClientPage />;
}
