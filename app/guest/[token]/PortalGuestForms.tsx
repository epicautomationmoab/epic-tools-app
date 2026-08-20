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
};

type PortalPayload = {
  reservation?: { guestForms?: GuestFormTask[] };
};

export default function PortalGuestForms() {
  const token = useParams<{ token: string }>()?.token;
  const [tasks, setTasks] = useState<GuestFormTask[]>([]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    const load = async () => {
      try {
        const response = await fetch(`/api/guest/${encodeURIComponent(token)}`, { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as PortalPayload;
        if (!cancelled) setTasks(data.reservation?.guestForms ?? []);
      } catch {
        // The main portal remains usable even if supplemental forms cannot be loaded.
      }
    };

    void load();
    const timer = window.setInterval(load, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [token]);

  if (!tasks.length) return null;

  const outstanding = tasks.filter((task) => task.status !== "completed");
  if (!outstanding.length) return null;

  return (
    <aside className={styles.panel} aria-label="Additional reservation forms">
      <div className={styles.heading}>
        <span className={styles.kicker}>Added to your reservation</span>
        <strong>{outstanding.length === 1 ? "One additional item needs your attention" : `${outstanding.length} additional items need your attention`}</strong>
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
      </div>
    </aside>
  );
}
