import type { ReactNode } from "react";
import OhvUploadEnhancer from "./OhvUploadEnhancer";
import ProtectionEnhancer from "./ProtectionEnhancer";
import PortalGuestForms from "./PortalGuestForms";

export default function GuestPortalLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <PortalGuestForms />
      <OhvUploadEnhancer />
      <ProtectionEnhancer />
    </>
  );
}
