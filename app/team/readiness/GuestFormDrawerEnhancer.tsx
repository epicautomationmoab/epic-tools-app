"use client";

import { useEffect, useRef, useState } from "react";

type GuestFormTask = {
  id: string;
  task_status: string;
  templateKey: string | null;
  pdfReady: boolean;
  documentUrl: string | null;
};

type PortalActivity = {
  readinessId: string;
  businessLine: string;
  productDisplayName: string;
};

type PortalResponse = {
  reservation: { activities: PortalActivity[] };
};

function portalLinkFromDrawer() {
  const drawer = document.querySelector<HTMLElement>('[role="dialog"]');
  return drawer?.querySelector<HTMLAnchorElement>('a[href^="/guest/"]') ?? null;
}

function portalTokenFromDrawer() {
  const match = portalLinkFromDrawer()?.getAttribute("href")?.match(/^\/guest\/([^/?#]+)/);
  return match?.[1] ?? null;
}

function businessLineFromDrawer() {
  const drawer = document.querySelector<HTMLElement>('[role="dialog"]');
  if (!drawer) return null;
  const cards = Array.from(drawer.querySelectorAll<HTMLElement>("div"));
  const assure = cards.find((card) => card.querySelector(":scope > span")?.textContent?.trim() === "Adventure Assure");
  const value = assure?.querySelector(":scope > strong")?.textContent?.trim();
  return value === "Tour" ? "tour" : value ? "rental" : null;
}

function drawerText() {
  return document.querySelector<HTMLElement>('[role="dialog"]')?.textContent ?? "";
}

function actionRow() {
  return portalLinkFromDrawer()?.parentElement ?? null;
}

function drawerKey() {
  const token = portalTokenFromDrawer();
  const line = businessLineFromDrawer();
  return token && line ? `${token}|${line}` : "";
}

function buttonStyle(button: HTMLButtonElement) {
  button.style.display = "inline-flex";
  button.style.alignItems = "center";
  button.style.justifyContent = "center";
  button.style.gap = "6px";
  button.style.marginLeft = "10px";
  button.style.padding = "10px 12px";
  button.style.border = "1px solid #c8d0d7";
  button.style.borderRadius = "8px";
  button.style.background = "#fff";
  button.style.color = "#26313b";
  button.style.fontWeight = "850";
  button.style.cursor = "pointer";
}

function bestActivityMatch(activities: PortalActivity[], businessLine: string) {
  const candidates = activities.filter((activity) => activity.businessLine.toLowerCase() === businessLine);
  if (candidates.length <= 1) return candidates[0] ?? null;
  const text = drawerText().toLowerCase();
  return candidates.find((activity) => text.includes(activity.productDisplayName.toLowerCase())) ?? candidates[0] ?? null;
}

export default function GuestFormDrawerEnhancer() {
  const [key, setKey] = useState("");
  const lastKey = useRef("");

  useEffect(() => {
    const sync = () => {
      const next = drawerKey();
      if (next !== lastKey.current) {
        lastKey.current = next;
        setKey(next);
      }
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    document.getElementById("guest-form-quick-add")?.remove();

    const token = portalTokenFromDrawer();
    const businessLine = businessLineFromDrawer();
    const row = actionRow();
    if (!key || !token || !businessLine || !row) return;

    const resolvedToken = token;
    const resolvedBusinessLine = businessLine;
    const resolvedRow = row;

    async function setup() {
      try {
        const portalResponse = await fetch(`/api/guest/${encodeURIComponent(resolvedToken)}`, { cache: "no-store" });
        const portal = await portalResponse.json() as PortalResponse & { error?: string };
        if (!portalResponse.ok || !portal.reservation) throw new Error(portal.error || "Unable to resolve reservation.");

        const activity = bestActivityMatch(portal.reservation.activities, resolvedBusinessLine);
        if (!activity || cancelled) return;

        const tasksResponse = await fetch(`/api/team/guest-forms/list?readinessId=${encodeURIComponent(activity.readinessId)}`, { cache: "no-store" });
        const tasksData = await tasksResponse.json() as { tasks?: GuestFormTask[]; error?: string };
        if (!tasksResponse.ok) throw new Error(tasksData.error || "Unable to load portal forms.");

        const templateKey = resolvedBusinessLine === "rental" ? "pet_acknowledgment" : "minor_driver_authorization";
        const label = resolvedBusinessLine === "rental" ? "🦮 Pet" : "🧍 Teen Driver";
        const task = (tasksData.tasks ?? []).find((item) => item.templateKey === templateKey && item.task_status !== "cancelled");

        const button = document.createElement("button");
        button.id = "guest-form-quick-add";
        button.type = "button";
        buttonStyle(button);

        if (task?.task_status === "completed") {
          button.textContent = `✓ ${label}`;
          button.title = "Completed";
          if (task.pdfReady && task.documentUrl) {
            button.onclick = () => window.open(task.documentUrl!, "_blank", "noopener,noreferrer");
          } else {
            button.disabled = true;
            button.style.opacity = "0.65";
            button.style.cursor = "default";
          }
        } else if (task && task.task_status !== "expired") {
          button.textContent = `${label} ✓`;
          button.title = "Already in My Epic Reservation";
          button.disabled = true;
          button.style.opacity = "0.65";
          button.style.cursor = "default";
        } else {
          button.textContent = label;
          button.title = resolvedBusinessLine === "rental"
            ? "Add Pet Acknowledgment to My Epic Reservation"
            : "Add Teen Driver Authorization to My Epic Reservation";
          button.onclick = async () => {
            const original = button.textContent;
            button.disabled = true;
            button.textContent = "Adding…";
            button.style.opacity = "0.65";
            try {
              const response = await fetch("/api/team/guest-forms/create", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ readinessId: activity.readinessId, templateKey }),
              });
              const result = await response.json() as { error?: string };
              if (!response.ok) throw new Error(result.error || "Unable to add form to portal.");
              button.textContent = `${label} ✓`;
              button.title = "Added to My Epic Reservation";
              button.style.opacity = "1";
            } catch (error) {
              window.alert(error instanceof Error ? error.message : "Unable to add form to portal.");
              button.textContent = original;
              button.disabled = false;
              button.style.opacity = "1";
            }
          };
        }

        resolvedRow.appendChild(button);
      } catch (error) {
        console.error("Guest form quick add unavailable", error);
      }
    }

    void setup();
    return () => {
      cancelled = true;
      document.getElementById("guest-form-quick-add")?.remove();
    };
  }, [key]);

  return null;
}
