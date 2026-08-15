"use client";

import { useEffect, useState } from "react";

type SignedWaiver = {
  id: string;
  signerName: string;
  signerEmail: string | null;
  signedAt: string;
  copyEmailStatus: string | null;
  copyEmailSentAt: string | null;
};

export default function SignedWaiversPanel({
  readinessId,
}: {
  readinessId?: string;
}) {
  const [waivers, setWaivers] = useState<SignedWaiver[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!readinessId) {
      setWaivers([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError("");

    fetch(`/api/team/waivers?readiness_id=${encodeURIComponent(readinessId)}`, {
      cache: "no-store",
    })
      .then(async (response) => {
        const json = await response.json();
        if (!response.ok) {
          throw new Error(json.error || "Unable to load signed waivers.");
        }
        if (!cancelled) setWaivers(json.waivers || []);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Unable to load signed waivers.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [readinessId]);

  if (!readinessId) return null;

  return (
    <section
      style={{
        marginTop: 18,
        padding: 18,
        border: "1px solid #dde2e7",
        borderRadius: 12,
        background: "#fff",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "center",
          marginBottom: waivers.length || loading || error ? 12 : 0,
        }}
      >
        <div>
          <div style={{ fontWeight: 900, color: "#202733" }}>
            Epic Signed Waivers
          </div>
          <div style={{ marginTop: 3, fontSize: 13, color: "#6b7280" }}>
            Epic-owned signed PDF records
          </div>
        </div>
        {waivers.length ? (
          <span
            style={{
              fontSize: 12,
              fontWeight: 900,
              padding: "5px 9px",
              borderRadius: 999,
              background: "#edf8f1",
              color: "#17613d",
            }}
          >
            {waivers.length} signed
          </span>
        ) : null}
      </div>

      {loading ? (
        <div style={{ fontSize: 13, color: "#6b7280" }}>Loading waivers…</div>
      ) : null}

      {error ? (
        <div style={{ fontSize: 13, color: "#9b2c2c" }}>{error}</div>
      ) : null}

      {!loading && !error && !waivers.length ? (
        <div style={{ fontSize: 13, color: "#6b7280" }}>
          No Epic signed waiver PDF is stored for this visit yet.
        </div>
      ) : null}

      {waivers.length ? (
        <div style={{ display: "grid", gap: 10 }}>
          {waivers.map((waiver) => (
            <div
              key={waiver.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 14,
                padding: 12,
                border: "1px solid #e6e9ed",
                borderRadius: 10,
                background: "#fafbfc",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 850, color: "#202733" }}>
                  {waiver.signerName}
                </div>
                <div style={{ marginTop: 3, fontSize: 12, color: "#6b7280" }}>
                  Signed {new Date(waiver.signedAt).toLocaleString("en-US")}
                  {waiver.copyEmailStatus === "sent" ? " · Copy emailed" : ""}
                </div>
              </div>

              <a
                href={`/api/team/waivers/${waiver.id}/pdf`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  flex: "0 0 auto",
                  textDecoration: "none",
                  background: "#202733",
                  color: "#fff",
                  borderRadius: 8,
                  padding: "9px 12px",
                  fontSize: 13,
                  fontWeight: 900,
                }}
              >
                View Signed Waiver
              </a>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
