import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EpicTools",
  description: "Epic 4x4 guest readiness tools",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
