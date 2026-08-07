"use client";

import { useEffect, useState } from "react";

type TeamProfile = {
  id: string;
  user_id: string | null;
  display_name: string;
  email: string;
  role: "admin" | "manager" | "agent";
  active: boolean;
  tripworks_user_id: number;
};

export default function InviteTeamPanel() {
  const [profiles, setProfiles] = useState<TeamProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingEmail, setWorkingEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadProfiles() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/team-invites", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to load employees.");
      setProfiles(payload.profiles || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load employees.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadProfiles();
  }, []);

  async function invite(email: string, displayName: string) {
    setWorkingEmail(email);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/admin/team-invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to send invitation.");
      setMessage(
        payload.alreadyLinked
          ? `${displayName} already has a linked Supabase Auth account.`
          : `Invitation sent to ${displayName}.`,
      );
      await loadProfiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send invitation.");
    } finally {
      setWorkingEmail("");
    }
  }

  return (
    <div style={{ width: "100%", maxWidth: 900 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ marginBottom: 8 }}>EpicTools Employee Auth Setup</h1>
        <p style={{ margin: 0, color: "#667085" }}>
          Invite one employee at a time. Start with Jennifer, verify her account works, then invite the rest.
        </p>
      </div>

      {message ? <div style={{ padding: 12, marginBottom: 14, background: "#ecfdf3", borderRadius: 8 }}>{message}</div> : null}
      {error ? <div style={{ padding: 12, marginBottom: 14, background: "#fef3f2", color: "#b42318", borderRadius: 8 }}>{error}</div> : null}

      {loading ? (
        <p>Loading employees...</p>
      ) : (
        <div style={{ overflowX: "auto", background: "#fff", border: "1px solid #e4e7ec", borderRadius: 12 }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {['Employee', 'Role', 'TripWorks ID', 'Auth status', ''].map((label) => (
                  <th key={label} style={{ textAlign: "left", padding: 12, borderBottom: "1px solid #e4e7ec" }}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {profiles.map((profile) => (
                <tr key={profile.id}>
                  <td style={{ padding: 12, borderBottom: "1px solid #f2f4f7" }}>
                    <strong>{profile.display_name}</strong><br />
                    <span style={{ color: "#667085" }}>{profile.email}</span>
                  </td>
                  <td style={{ padding: 12, borderBottom: "1px solid #f2f4f7" }}>{profile.role}</td>
                  <td style={{ padding: 12, borderBottom: "1px solid #f2f4f7" }}>{profile.tripworks_user_id}</td>
                  <td style={{ padding: 12, borderBottom: "1px solid #f2f4f7" }}>
                    {profile.user_id ? "Linked" : "Not invited"}
                  </td>
                  <td style={{ padding: 12, borderBottom: "1px solid #f2f4f7" }}>
                    <button
                      type="button"
                      disabled={!profile.active || Boolean(profile.user_id) || workingEmail === profile.email}
                      onClick={() => void invite(profile.email, profile.display_name)}
                      style={{
                        border: 0,
                        borderRadius: 8,
                        padding: "9px 14px",
                        background: profile.user_id ? "#d0d5dd" : "#d5521d",
                        color: "#fff",
                        fontWeight: 700,
                        cursor: profile.user_id ? "default" : "pointer",
                      }}
                    >
                      {workingEmail === profile.email ? "Sending..." : profile.user_id ? "Linked" : "Send invite"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
