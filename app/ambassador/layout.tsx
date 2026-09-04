import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "Epic Ambassador",
    template: "%s | Epic Ambassador",
  },
  description: "Epic 4X4 Ambassador referral and rewards portal",
};

export default function AmbassadorLayout({ children }: { children: React.ReactNode }) {
  return children;
}
