"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import styles from "./PortalGuestForms.module.css";

type GuestFormTask = {
  taskId: string;
  status: string;
  required: boolean;
  completedAt: string | null;
  assignedGuestName: string | null;
  templateKey: string | null;
  templateName: string | null;
  title: string;
  description: string | null;
  openUrl: string | null;
  documentUrl: string | null;
};

type FormsPayload = { tasks?: GuestFormTask[] };

export default function PortalGuestForms() {
  const token = useParams<{ token: string }>()?.token;
  const [tasks, setTasks] = useState<GuestFormTask[]>([]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    const load = async () => {
      try {
        const response = await fetch(`/api/guest/${encodeURIComponent(token)}/guest-forms`, { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as FormsPayload;
        if (!cancelled) setTasks(data.tasks ?? []);
      } catch {
        // Supplemental forms must never block the reservation portal.
      }
    };

    void load();
    const timer = window.setInterval(load, 8000);
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [token]);

  if (!tasks.length) return null;

  const outstanding = tasks.filter((task) => task.status !== "completed");
  const completed = tasks.filter((task) => task.status === "completed");

  return (
    <aside className={styles.panel} aria-label="Additional reservation forms">
      <div className={styles.heading}>
        <span className={styles.kicker}>Added to your reservation</span>
        <strong>
          {outstanding.length
            ? outstanding.length === 1
              ? "One additional item needs your attention"
              : `${outstanding.length} additional items need your attention`
            : "Additional reservation forms complete"}
        </strong>
      </div>

      <div className={styles.tasks}>
        {outstanding.map((task) => (
          <a className={styles.task} href={task.openUrl ?? "#"} key={task.taskId}>
            <span className={styles.taskText}>
              <strong>{task.title}</strong>
              <small>{task.assignedGuestName ? `For ${task.assignedGuestName}` : "Please complete this form"}</small>
            </span>
            <span className={styles.action}>Complete</span>
          </a>
        ))}

        {completed.map((task) => task.documentUrl ? (
          <a className={`${styles.task} ${styles.completedTask}`} href={task.documentUrl} target="_blank" rel="noopener noreferrer" key={task.taskId}>
            <span className={styles.taskText}>
              <strong>{task.title}</strong>
              <small>{task.completedAt ? `Completed ${new Date(task.completedAt).toLocaleDateString()}` : "Completed"}</small>
            </span>
            <span className={styles.action}>View Signed Form</span>
          </a>
        ) : (
          <div className={`${styles.task} ${styles.completedTask}`} key={task.taskId}>
            <span className={styles.taskText}>
              <strong>{task.title}</strong>
              <small>{task.completedAt ? `Completed ${new Date(task.completedAt).toLocaleDateString()}` : "Completed"}</small>
            </span>
            <span className={styles.completeBadge}>✓ Complete</span>
          </div>
        ))}
      </div>
    </aside>
  );
}
