"use client";

import { useEffect, useState } from "react";
import AddEmployeeForm from "./AddEmployeeForm";

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
  const [filter, setFilter] = useState<"active" | "all">("active");
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

  async function employeeCreated(name: string) {
    setMessage(`${name} was added. You can now send their EpicTools invitation below.`);
    setError("");
    await loadProfiles();
  }

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

  async function setAccess(profile: TeamProfile, active: boolean) {
    const actionLabel = active ? "reactivate" : "archive";
    if (!active && !window.confirm(`Archive ${profile.display_name}? They will immediately lose EpicTools access, but their profile and history will remain in the system.`)) {
      return;
    }

    const key = `${actionLabel}:${profile.id}`;
    setWorkingKey(key);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/admin/team-invites", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile_id: profile.id, active }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to update employee access.");

      setMessage(
        active
          ? `${profile.display_name} was reactivated.`
          : `${profile.display_name} was archived. Their history is preserved and EpicTools access is disabled.`,
      );
      await loadProfiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update employee access.");
    } finally {
      setWorkingKey("");
    }
  }

  const visibleProfiles = filter === "active" ? profiles.filter((profile) => profile.active) : profiles;
  const activeCount = profiles.filter((profile) => profile.active).length;

  const cellStyle = { padding: "12px 14px", borderBottom: "1px solid #f2f4f7", verticalAlign: "middle" as const };

  return (
    <div style={{ width: "100%" }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ marginBottom: 8 }}>EpicTools Employee Auth Setup</h1>
        <p style={{ margin: 0, color: "#667085" }}>
          Invite new employees, resend pending invitations, and send password resets for existing accounts. Employee PINs are created during initial activation and are not changed by a password reset.
        </p>
      </div>

      {message ? <div style={{ padding: 12, marginBottom: 14, background: "#ecfdf3", borderRadius: 8 }}>{message}</div> : null}
      {error ? <div style={{ padding: 12, marginBottom: 14, background: "#fef3f2", color: "#b42318", borderRadius: 8 }}>{error}</div> : null}

      <AddEmployeeForm onCreated={employeeCreated} />

      {loading ? (
        <p>Loading team profiles...</p>
      ) : (
        <>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
            <button
              type="button"
              onClick={() => setFilter("active")}
              style={{
                border: filter === "active" ? "1px solid #344054" : "1px solid #d0d5dd",
                borderRadius: 8,
                padding: "8px 12px",
                background: filter === "active" ? "#344054" : "#fff",
                color: filter === "active" ? "#fff" : "#344054",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Active ({activeCount})
            </button>
            <button
              type="button"
              onClick={() => setFilter("all")}
              style={{
                border: filter === "all" ? "1px solid #344054" : "1px solid #d0d5dd",
                borderRadius: 8,
                padding: "8px 12px",
                background: filter === "all" ? "#344054" : "#fff",
                color: filter === "all" ? "#fff" : "#344054",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              All ({profiles.length})
            </button>
          </div>
          <div style={{ background: "#fff", border: "1px solid #e4e7ec", borderRadius: 12, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: "26%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "14%" }} />
              <col style={{ width: "27%" }} />
              <col style={{ width: "21%" }} />
            </colgroup>
            <thead>
              <tr style={{ background: "#f2f2f3" }}>
                {['Profile', 'Role', 'TripWorks ID', 'Auth status', 'Account action'].map((label) => (
                  <th key={label} style={{ textAlign: "left", padding: "12px 14px", borderBottom: "1px solid #e4e7ec", color: "#666", fontSize: 12, textTransform: "uppercase", letterSpacing: ".02em" }}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleProfiles.map((profile) => {
                const inviteKey = `invite:${profile.email}`;
                const resetKey = `reset_password:${profile.email}`;
                const isWorkstation = profile.role === "workstation";
                return (
                  <tr key={profile.id}>
                    <td style={cellStyle}>
                      <strong>{profile.display_name}</strong><br />
                      <span style={{ color: "#667085", overflowWrap: "anywhere" }}>{profile.email}</span>
                    </td>
                    <td style={cellStyle}>{profile.role}</td>
                    <td style={cellStyle}>{profile.tripworks_user_id ?? "—"}</td>
                    <td style={cellStyle}>
                      {!profile.active
                        ? "Archived / access disabled"
                        : isWorkstation
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
                    <td style={cellStyle}>
                      {isWorkstation ? (
                        <span style={{ color: "#667085" }}>Managed separately</span>
                      ) : !profile.active ? (
                        <button
                          type="button"
                          disabled={Boolean(workingKey)}
                          onClick={() => void setAccess(profile, true)}
                          style={{ border: "1px solid #b7dfc5", borderRadius: 8, padding: "9px 12px", background: "#eefaf2", color: "#18794e", fontWeight: 700, cursor: workingKey ? "wait" : "pointer", whiteSpace: "nowrap", maxWidth: "100%" }}
                        >
                          {workingKey === `reactivate:${profile.id}` ? "Saving..." : "Reactivate"}
                        </button>
                      ) : (
                        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                          {profile.user_id ? (
                            <button
                              type="button"
                              disabled={Boolean(workingKey)}
                              onClick={() => void manageAuth(profile, "reset_password")}
                              style={{ border: "1px solid #d0d5dd", borderRadius: 8, padding: "9px 12px", background: "#fff", color: "#344054", fontWeight: 700, cursor: workingKey ? "wait" : "pointer", whiteSpace: "nowrap", maxWidth: "100%" }}
                            >
                              {workingKey === resetKey ? "Sending..." : "Reset password"}
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={Boolean(workingKey)}
                              onClick={() => void manageAuth(profile, "invite")}
                              style={{ border: 0, borderRadius: 8, padding: "9px 12px", background: "#d5521d", color: "#fff", fontWeight: 700, cursor: workingKey ? "wait" : "pointer", whiteSpace: "nowrap", maxWidth: "100%" }}
                            >
                              {workingKey === inviteKey
                                ? "Sending..."
                                : profile.invitation_pending
                                  ? "Resend invite"
                                  : "Send invite"}
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={Boolean(workingKey)}
                            onClick={() => void setAccess(profile, false)}
                            style={{ border: "1px solid #f0b8b8", borderRadius: 8, padding: "9px 12px", background: "#fff6f6", color: "#b42318", fontWeight: 700, cursor: workingKey ? "wait" : "pointer", whiteSpace: "nowrap", maxWidth: "100%" }}
                          >
                            {workingKey === `archive:${profile.id}` ? "Saving..." : "Archive"}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </>
      )}
    </div>
  );
}
