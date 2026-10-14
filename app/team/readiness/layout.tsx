import type { ReactNode } from "react";

export default function ReadinessLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <>
      <style>{`
        [class*="toolbar"] + [class*="tableCard"] {
          max-height: calc(100vh - 320px);
          min-height: 280px;
          overflow: auto;
        }

        [class*="toolbar"] + [class*="tableCard"] thead th {
          position: sticky;
          top: 0;
          z-index: 3;
          box-shadow: inset 0 -1px 0 #e3e7eb;
        }
      `}</style>
      {children}
    </>
  );
}
