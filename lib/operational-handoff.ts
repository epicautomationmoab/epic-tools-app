/** Both existing Readiness surfaces use the same authenticated server operation. */
export async function saveOperationalHandoff(
  readinessId: string,
  handoffStatus: "checked_in" | "rental_out" | "rental_returned",
) {
  const response = await fetch("/api/team/readiness/handoff", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ readiness_id: readinessId, handoff_status: handoffStatus }),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || "Unable to update reservation status.");
  }
}
