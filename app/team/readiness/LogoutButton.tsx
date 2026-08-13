"use client";

import { useState } from "react";

export default function LogoutButton() {
  const [working, setWorking] = useState(false);

  async function logout() {
    if (working) return;
    setWorking(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.href = "/employee-login";
    }
  }

  return (
    <button
      type="button"
      onClick={() => void logout()}
      disabled={working}
      style={{
        height: 38,
        border: "1px solid #d0d5dd",
        borderRadius: 8,
        background: "#fff",
        color: "#344054",
        padding: "0 14px",
        fontWeight: 700,
        cursor: working ? "wait" : "pointer",
      }}
    >
      {working ? "Logging out..." : "Logout"}
    </button>
  );
}
