import type { ReactNode } from "react";
import OhvUploadEnhancer from "./OhvUploadEnhancer";
import ProtectionEnhancer from "./ProtectionEnhancer";

export default function GuestPortalLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <OhvUploadEnhancer />
      <ProtectionEnhancer />
    </>
  );
}
