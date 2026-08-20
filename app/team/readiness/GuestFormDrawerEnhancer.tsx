"use client";

import { useEffect, useState } from "react";
import styles from "./GuestFormDrawerEnhancer.module.css";

type GuestFormTask = {
  id: string;
  task_status: string;
  templateKey: string | null;
  templateName: string | null;
  formTitle: string | null;
  documentId: string | null;
  pdfReady: boolean;
  documentUrl: string | null;
  completed_at: string | null;
};

type PortalActivity = {
  readinessId: string;
  businessLine: string;
  productDisplayName: string;
  visitStartTime: string;
};

type PortalResponse = {
  reservation?: { activities?: PortalActivity[] };
  error?: string;
};

function portalTokenFromDrawer() {
  const link = document.querySelector<HTMLAnchorElement>('[role="dialog"] a[href^="/guest/"]');
  const match = link?.getAttribute("href")?.match(/^\/guest\/([^/?#]+)/);
  return match?.[1] ?? null;
}

function drawerSummary() {
  const drawer = document.querySelector<HTMLElement>('[role="dialog"]');
  if (!drawer) return null;
  const text = drawer.textContent ?? "";
  const businessLine = text.includes("Adventure AssureTour") || text.includes("Adventure Assure Tour") ? "tour" : "rental";
  const title = drawer.querySelector("header p:last-of-type")?.textContent ?? "";
  return { businessLine, title };
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function chooseActivity(activities: PortalActivity[], line: string, drawerText: string) {
  const sameLine = activities.filter((activity) => activity.businessLine?.toLowerCase() === line);
  if (sameLine.length <= 1) return sameLine[0] ?? null;
  const haystack = normalize(drawerText);
  return sameLine.find((activity) => haystack.includes(normalize(activity.productDisplayName))) ?? sameLine[0] ?? null;
}

function insertionPoint() {
  const drawer = document.querySelector<HTMLElement>('[role="dialog"]');
  if (!drawer) return null;
  const sections = Array.from(drawer.querySelectorAll<HTMLElement>("section"));
  return sections.find((section) => section.querySelector("h3")?.textContent?.includes("MPWR Waivers")) ?? sections[0] ?? null;
}

function statusLabel(task: GuestFormTask | undefined) {
  if (!task) return "Not in portal";
  if (task.task_status === "completed") return "Completed";
  if (task.task_status === "opened") return "Opened";
  if (task.task_status === "expired") return "Expired";
  return "In portal";
}

export default function GuestFormDrawerEnhancer() {
  const [portalToken, setPortalToken] = useState<string | null>(null);
  const [readinessId, setReadinessId] = useState<string | null>(null);
  const [businessLine, setBusinessLine] = useState<string | null>(null);
  const [tasks, setTasks] = useState<GuestFormTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [workingKey, setWorkingKey] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const sync = () => setPortalToken(portalTokenFromDrawer());
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!portalToken) {
      setReadinessId(null);
      setBusinessLine(null);
      setTasks([]);
      return;
    }

    let cancelled = false;
    const summary = drawerSummary();
    if (!summary) return;

    fetch(`/api/guest/${encodeURIComponent(portalToken)}`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json() as PortalResponse;
        if (!response.ok || !data.reservation) throw new Error(data.error || "Unable to resolve guest portal.");
        return data.reservation.activities ?? [];
      })
      .then((activities) => {
        if (cancelled) return;
        const activity = chooseActivity(activities, summary.businessLine, summary.title);
        setReadinessId(activity?.readinessId ?? null);
        setBusinessLine(activity?.businessLine?.toLowerCase() ?? null);
      })
      .catch((caught) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Unable to resolve guest portal.");
      });

    return () => { cancelled = true; };
  }, [portalToken]);

  async function loadTasks(id: string) {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/team/guest-forms/list?readinessId=${encodeURIComponent(id)}`, { cache: "no-store" });
      const data = await response.json() as { tasks?: GuestFormTask[]; error?: string };
      if (!response.ok) throw new Error(data.error || "Unable to load portal forms.");
      setTasks(data.tasks ?? []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load portal forms.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!readinessId) {
      setTasks([]);
      return;
    }
    void loadTasks(readinessId);
  }, [readinessId]);

  async function addToPortal(templateKey: string) {
    if (!readinessId) return;
    setWorkingKey(templateKey);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/team/guest-forms/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ readinessId, templateKey }),
      });
      const data = await response.json() as { error?: string; templateName?: string };
      if (!response.ok) throw new Error(data.error || "Unable to add form to portal.");
      setMessage(`${data.templateName || "Form"} added to My Epic Reservation.`);
      await loadTasks(readinessId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to add form to portal.");
    } finally {
      setWorkingKey(null);
    }
  }

  useEffect(() => {
    const existing = document.getElementById("guest-form-drawer-enhancer");
    if (existing) existing.remove();
    if (!readinessId || !businessLine) return;

    const target = insertionPoint();
    if (!target?.parentElement) return;

    const root = document.createElement("section");
    root.id = "guest-form-drawer-enhancer";
    root.className = styles.section;

    const heading = document.createElement("div");
    heading.className = styles.heading;
    heading.innerHTML = `<div><span>My Epic Reservation</span><h3>Guest Portal Forms</h3></div><strong class="${styles.status}">${loading ? "Loading…" : `${tasks.length} active`}</strong>`;
    root.appendChild(heading);

    const allowed = businessLine === "rental"
      ? [{ key: "pet_acknowledgment", label: "Pet Acknowledgment" }]
      : [{ key: "minor_driver_authorization", label: "Teen Driver Authorization" }];

    for (const form of allowed) {
      const task = tasks.find((item) => item.templateKey === form.key);
      const row = document.createElement("div");
      row.className = styles.row;

      const copy = document.createElement("div");
      copy.className = styles.copy;
      const title = document.createElement("strong");
      title.textContent = form.label;
      const status = document.createElement("small");
      status.textContent = statusLabel(task);
      if (task?.task_status === "completed") status.className = styles.complete;
      copy.append(title, status);
      row.appendChild(copy);

      const actions = document.createElement("div");
      actions.className = styles.actions;

      if (!task || task.task_status === "expired") {
        const button = document.createElement("button");
        button.type = "button";
        button.className = styles.button;
        button.disabled = workingKey === form.key;
        button.textContent = workingKey === form.key ? "Adding…" : "Add to Portal";
        button.onclick = () => void addToPortal(form.key);
        actions.appendChild(button);
      }

      if (task?.pdfReady && task.documentUrl) {
        const link = document.createElement("a");
        link.className = styles.link;
        link.href = task.documentUrl;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = "View Signed PDF";
        actions.appendChild(link);
      }

      row.appendChild(actions);
      root.appendChild(row);
    }

    if (message) {
      const note = document.createElement("div");
      note.className = styles.success;
      note.textContent = message;
      root.appendChild(note);
    }
    if (error) {
      const note = document.createElement("div");
      note.className = styles.error;
      note.textContent = error;
      root.appendChild(note);
    }

    target.insertAdjacentElement("afterend", root);
    return () => root.remove();
  }, [readinessId, businessLine, tasks, loading, workingKey, message, error]);

  return null;
}
