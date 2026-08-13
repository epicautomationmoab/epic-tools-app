import type { ReactNode } from "react";

export default function ReadinessLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <>
      <style>{`
        [class*="moneyBad"] {
          font-size: 0 !important;
        }

        [class*="moneyBad"]::after {
          content: "$ Due";
          font-size: 0.875rem;
        }

        [class*="balanceDue"] strong > a {
          font-size: 0 !important;
        }

        [class*="balanceDue"] strong > a::after {
          content: "$ Due";
          font-size: 1rem;
        }

        [class*="balanceDue"] strong:not(:has(a)) {
          font-size: 0 !important;
        }

        [class*="balanceDue"] strong:not(:has(a))::after {
          content: "$ Due";
          font-size: 1rem;
        }
      `}</style>
      {children}
    </>
  );
}
