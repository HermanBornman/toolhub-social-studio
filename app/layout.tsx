import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Toolhub Social Studio",
  description: "Create approved Toolhub product adverts from a locked master template.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

