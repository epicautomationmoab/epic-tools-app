import type { ReactNode } from "react";
import SignaturePadResetFix from "./SignaturePadResetFix";

export default function GuestFormLayout({ children }: { children: ReactNode }) {
  return <><SignaturePadResetFix />{children}</>;
}
