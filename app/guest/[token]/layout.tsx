import type { ReactNode } from "react";
import OhvUploadEnhancer from "./OhvUploadEnhancer";

export default function GuestPortalLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <OhvUploadEnhancer />
    </>
  );
}
