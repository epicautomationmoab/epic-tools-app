import type { Metadata } from "next";
import "./globals.css";
import Customer360Enhancer from "./customer-360/Customer360Enhancer";
import IncomingCallPopup from "./IncomingCallPopup";
import CancellationAutoPopup from "./customer-360/CancellationAutoPopup";

const epicIcon = "https://myepicreservation.com/epic-logo.png?v=epicc360";

export const metadata: Metadata = {
  title: "EpicC360 — Epic 4X4 Adventures",
  description: "Epic 4X4 Adventures customer communications, sales, history, and service workspace",
  icons: {
    icon: [{ url: epicIcon, type: "image/png" }],
    shortcut: [{ url: epicIcon, type: "image/png" }],
    apple: [{ url: epicIcon, type: "image/png" }],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href={epicIcon} type="image/png" />
        <link rel="shortcut icon" href={epicIcon} type="image/png" />
      </head>
      <body><Customer360Enhancer />{children}<IncomingCallPopup /><CancellationAutoPopup /></body>
    </html>
  );
}
