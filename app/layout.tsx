import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
title: "Toolhub Weekly Advert Generator",
description: "Create approved Toolhub weekly social media adverts.",
icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
return (
<html lang="en">
<body>{children}</body>
</html>
);
}

