import "./waiver.css";
import type { ReactNode } from "react";
import WaiverBusinessLineGate from "./WaiverBusinessLineGate";

export default function WaiverLayout({ children }: { children: ReactNode }) {
  return <WaiverBusinessLineGate>{children}</WaiverBusinessLineGate>;
}
