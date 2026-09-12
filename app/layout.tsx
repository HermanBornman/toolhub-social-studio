import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Toolhub Social Studio",
  description: "Create approved Toolhub product adverts from a locked master template.",
};

// The studio is backed by per-user SQLite workflow state and must never be
// prerendered with a build-time database snapshot.
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
