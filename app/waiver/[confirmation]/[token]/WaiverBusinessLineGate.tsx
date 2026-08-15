"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useParams } from "next/navigation";
import RentalTermsForm from "./RentalTermsForm";

type Session = {
  confirmation_code: string;
  customer_name: string | null;
  customer_phone: string | null;
  start_time: string | null;
  experience_name: string | null;
  experience_internal_name: string | null;
  business_line: string | null;
  rental_terms_html: string | null;
  total_vehicle_count: number;
};

export default function WaiverBusinessLineGate({ children }: { children: ReactNode }) {
  const params = useParams<{ confirmation: string; token: string }>();
  const confirmation = decodeURIComponent(params.confirmation);
  const token = decodeURIComponent(params.token);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch(`/api/waiver/${encodeURIComponent(confirmation)}/${encodeURIComponent(token)}`)
      .then(async (response) => {
        const json = await response.json();
        if (!response.ok) throw new Error(json.error || "Unable to load agreement.");
        setSession(json.session);
      })
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, [confirmation, token]);

  if (loading) {
    return <main className="waiver-page"><div className="waiver-shell waiver-status">Loading agreement…</div></main>;
  }

  if (!failed && session?.business_line === "rental") {
    return <RentalTermsForm session={session} confirmation={confirmation} token={token} />;
  }

  return children;
}
