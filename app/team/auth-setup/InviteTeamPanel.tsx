"use client";

import { useEffect, useState } from "react";

type TeamProfile = {
  id: string;
  user_id: string | null;
  display_name: string;
  email: string;
  role: "admin" | "manager" | "agent" | "workstation";
  active: boolean;
  tripworks_user_id: number | null;
  invitation_pending?: boolean;
  invitation_sent_at?: string | null;
};

export default function InviteTeamPanel() {
  const [profiles, setProfiles] = useState<TeamProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingKey, setWorkingKey] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadProfiles() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/team-invites", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to load team profiles.");
      setProfiles(payload.profiles || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load team profiles.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadProfiles();
  }, []);

  async function manageAuth(profile: TeamProfile, action: "invite" | "reset_password") {
    const key = `${action}:${profile.email}`;
    setWorkingKey(key);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/admin/team-invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: profile.email, action }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to manage employee account.");

      setMessage(
        action === "reset_password"
          ? `Password reset sent to ${profile.display_name}.`
          : payload.alreadyLinked
            ? `${profile.display_name} already has a linked Supabase Auth account.`
            : profile.invitation_pending
              ? `Fresh invitation sent to ${profile.display_name}.`
              : `Invitation sent to ${profile.display_name}.`,
      );
      await loadProfiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to manage employee account.");
    } finally {
      setWorkingKey("");
    }
  }

  return (
    <div style={{ width: "100%", maxWidth: 980 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ marginBottom: 8 }}>EpicTools Employee Auth Setup</h1>
        <p style={{ margin: 0, color: "#667085" }}>
          Invite new employees, resend pending invitations, and send password resets for existing accounts. Employee PINs are created during initial activation and are not changed by a password reset.
        </p>
      </div>

      {message ? <div style={{ padding: 12, marginBottom: 14, background: "#ecfdf3", borderRadius: 8 }}>{message}</div> : null}
      {error ? <div style={{ padding: 12, marginBottom: 14, background: "#fef3f2", color: "#b42318", borderRadius: 8 }}>{error}</div> : null}

      {loading ? (
        <p>Loading team profiles...</p>
      ) : (
        <div style={{ overflowX: "auto", background: "#fff", border: "1px solid #e4e7ec", borderRadius: 12 }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {['Profile', 'Role', 'TripWorks ID', 'Auth status', 'Account action'].map((label) => (
                  <th key={label} style={{ textAlign: "left", padding: 12, borderBottom: "1px solid #e4e7ec" }}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {profiles.map((profile) => {
                const inviteKey = `invite:${profile.email}`;
                const resetKey = `reset_password:${profile.email}`;
                const isWorkstation = profile.role === "workstation";
                return (
                  <tr key={profile.id}>
                    <td style={{ padding: 12, borderBottom: "1px solid #f2f4f7" }}>
                      <strong>{profile.display_name}</strong><br />
                      <span style={{ color: "#667085" }}>{profile.email}</span>
                    </td>
                    <td style={{ padding: 12, borderBottom: "1px solid #f2f4f7" }}>{profile.role}</td>
                    <td style={{ padding: 12, borderBottom: "1px solid #f2f4f7" }}>{profile.tripworks_user_id ?? "—"}</td>
                    <td style={{ padding: 12, borderBottom: "1px solid #f2f4f7" }}>
                      {isWorkstation
                        ? "Shared workstation"
                        : profile.user_id
                          ? "Active / linked"
                          : profile.invitation_pending
                            ? "Invitation sent / pending setup"
                            : "Not invited"}
                      {profile.invitation_pending && profile.invitation_sent_at ? (
                        <div style={{ marginTop: 4, color: "#667085", fontSize: 12 }}>
                          {new Date(profile.invitation_sent_at).toLocaleString("en-US", {
                            month: "numeric",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </div>
                      ) : null}
                    </td>
                    <td style={{ padding: 12, borderBottom: "1px solid #f2f4f7" }}>
                      {isWorkstation ? (
                        <span style={{ color: "#667085" }}>Managed separately</span>
                      ) : profile.user_id ? (
                        <button
                          type="button"
                          disabled={!profile.active || Boolean(workingKey)}
                          onClick={() => void manageAuth(profile, "reset_password")}
                          style={{ border: "1px solid #d0d5dd", borderRadius: 8, padding: "9px 14px", background: "#fff", color: "#344054", fontWeight: 700, cursor: workingKey ? "wait" : "pointer" }}
                        >
                          {workingKey === resetKey ? "Sending..." : "Send password reset"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={!profile.active || Boolean(workingKey)}
                          onClick={() => void manageAuth(profile, "invite")}
                          style={{ border: 0, borderRadius: 8, padding: "9px 14px", background: "#d5521d", color: "#fff", fontWeight: 700, cursor: workingKey ? "wait" : "pointer" }}
                        >
                          {workingKey === inviteKey
                            ? "Sending..."
                            : profile.invitation_pending
                              ? "Resend invite"
                              : "Send invite"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
