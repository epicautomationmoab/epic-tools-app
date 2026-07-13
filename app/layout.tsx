import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import "./drawer.css";
import "./modern.css";

export const metadata: Metadata = {
  title: "EpicTools",
  description: "Epic 4x4 guest readiness tools",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang