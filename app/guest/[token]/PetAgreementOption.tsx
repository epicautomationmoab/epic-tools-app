"use client";

import { useEffect, useState } from "react";
import styles from "./PetAgreementOption.module.css";

type Task = { taskId: string; templateKey: string | null; status: string; openUrl: string | null; documentUrl: string | null };
export default function PetAgreementOption({ token }: { token: string }) {
  const [task, setTask] = useState<Task | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch(`/api/guest/${encodeURIComponent(token)}/guest-forms`, { cache: "no-store" });
        if (!response.ok) return;
        const payload = await response.json() as { tasks?: Task[] };
        if (!cancelled) setTask(payload.tasks?.find((t) => t.templateKey === "pet_acknowledgment") ?? null);
      } catch { /* The optional pet offer never blocks the portal. */ }
    };
    void load();
    const interval = window.setInterval(load, 8000);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, [token]);

  const completed = task?.status === "completed";
  async function create() {
    if (working || task) return;
    setWorking(true); setError("");
    try {
      const response = await fetch(`/api/guest/${encodeURIComponent(token)}/pet-agreement`, { method: "POST" });
      const payload = await response.json() as { taskId?: string; error?: string };
      if (!response.ok || !payload.taskId) throw new Error(payload.error || "Unable to open pet agreement.");
      window.location.assign(`/api/guest/${encodeURIComponent(token)}/guest-forms/${encodeURIComponent(payload.taskId)}/open`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to open pet agreement.");
      setWorking(false);
    }
  }
  return (
    <section className={styles.panel} aria-label="Optional pet agreement">
      <div>
        <span className={styles.eyebrow}>Optional · Rentals</span>
        <h2>Bringing your pet?</h2>
        <p>Planning to bring an animal along? Review and sign the Pet Acknowledgment before you arrive. The completed agreement will be available to our checkout team.</p>
        {error ? <p role="alert" className={styles.error}>{error}</p> : null}
      </div>
      {completed ? (
        task.documentUrl ? <a href={task.documentUrl} className={styles.done}>✓ Completed · View agreement</a>
          : <span className={styles.done}>✓ Pet Agreement Complete</span>
      ) : task?.openUrl ? (
        <a className={styles.action} href={task.openUrl}>Complete Pet Agreement</a>
      ) : <button type="button" className={styles.action} disabled={working} onClick={create}>
        {working ? "Opening…" : "Complete Pet Agreement"}
      </button>}
    </section>
  );
}
