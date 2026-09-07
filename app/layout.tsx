import type { Metadata } from "next";
import type { ReactNode } from "react";
import EmployeeSessionRefresher from "./EmployeeSessionRefresher";
import GuestPaymentBanner from "./GuestPaymentBanner";
import "./globals.css";
import "./drawer.css";
import "./readiness-overrides.css";

export const metadata: Metadata = {
  title: "EpicTools",
  description: "Epic 4x4 guest readiness tools",
  icons: {
    icon: "/epic-logo.png",
    shortcut: "/epic-logo.png",
    apple: "/epic-logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <EmployeeSessionRefresher />
        <GuestPaymentBanner />
        {children}
      </body>
    </html>
  );
}
