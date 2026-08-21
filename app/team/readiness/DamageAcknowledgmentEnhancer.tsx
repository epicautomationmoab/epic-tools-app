"use client";

import { useEffect } from "react";

type PortalActivity = { readinessId: string; businessLine: string; productDisplayName: string };
type PortalPayload = { reservation?: { activities?: PortalActivity[] } };
type GuestFormTask = { task_status: string; templateKey: string | null; pdfReady: boolean; documentUrl: string | null };

function portalTokenFromLink(link: HTMLAnchorElement) {
  return link.getAttribute("href")?.match(/^\/guest\/([^/?#]+)/)?.[1] ?? null;
}

function findBusinessLine(drawer: Element) {
  const cards = Array.from(drawer.querySelectorAll<HTMLElement>("div"));
  const assure = cards.find((card) => card.querySelector(":scope > span")?.textContent?.trim() === "Adventure Assure");
  const value = assure?.querySelector(":scope > strong")?.textContent?.trim();
  return value === "Tour" ? "tour" : value ? "rental" : null;
}

function bestActivityMatch(activities: PortalActivity[], drawer: Element) {
  const candidates = activities.filter((activity) => activity.businessLine?.toLowerCase() === "rental");
  if (candidates.length <= 1) return candidates[0] ?? null;
  const drawerText = drawer.textContent?.toLowerCase() ?? "";
  return candidates.find((activity) => drawerText.includes(activity.productDisplayName.toLowerCase())) ?? candidates[0] ?? null;
}

function findCancellationCard(drawer: Element) {
  const nodes = Array.from(drawer.querySelectorAll<HTMLElement>("h1,h2,h3,h4,strong,p,div"));
  const heading = nodes.find((node) => {
    const text = node.textContent?.trim();
    return text === "Cancellation Policy Acknowledgement" || text === "Cancellation Policy Acknowledgment";
  });
  return heading?.closest("section") as HTMLElement | null;
}

function makeSignedRow(documentUrl: string) {
  const row = document.createElement("div");
  row.id = "damage-acknowledgment-signed-row";
  row.style.margin = "10px 0 12px";
  row.style.padding = "10px 12px";
  row.style.border = "1px solid #f0c7ae";
  row.style.borderRadius = "10px";
  row.style.background = "#fff8f3";
  row.style.display = "flex";
  row.style.alignItems = "center";
  row.style.justifyContent = "space-between";
  row.style.gap = "12px";
  row.style.fontSize = "12px";
  row.style.width = "100%";
  row.style.boxSizing = "border-box";

  const status = document.createElement("span");
  status.textContent = "✓ Vehicle Damage Acknowledgment complete";
  status.style.fontWeight = "800";
  status.style.color = "#9a431f";

  const link = document.createElement("a");
  link.href = documentUrl;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = "View Signed Form";
  link.style.fontWeight = "850";
  link.style.color = "#1f67b1";
  link.style.textDecoration = "none";
  link.style.whiteSpace = "nowrap";
  row.append(status, link);
  return row;
}

function styleButton(button: HTMLButtonElement) {
  button.style.display = "inline-flex";
  button.style.alignItems = "center";
  button.style.justifyContent = "center";
  button.style.marginLeft = "8px";
  button.style.width = "42px";
  button.style.height = "42px";
  button.style.padding = "0";
  button.style.border = "1px solid #c8d0d7";
  button.style.borderRadius = "8px";
  button.style.background = "#fff";
  button.style.fontSize = "20px";
  button.style.lineHeight = "1";
  button.style.cursor = "pointer";
  button.style.flex = "0 0 42px";
}

export default function DamageAcknowledgmentEnhancer() {
  useEffect(() => {
    const timers = new Map<Element, number>();

    async function enhance() {
      const portalLink = document.querySelector<HTMLAnchorElement>('a[href^="/guest/"]');
      if (!portalLink) return;
      const drawer = portalLink.closest('[role="dialog"]') as HTMLElement | null;
      if (!drawer || drawer.querySelector("#damage-acknowledgment-quick-add") || drawer.dataset.damageAcknowledgmentEnhancing === "true") return;
      if (findBusinessLine(drawer) !== "rental") return;
      const portalToken = portalTokenFromLink(portalLink);
      if (!portalToken) return;

      drawer.dataset.damageAcknowledgmentEnhancing = "true";
      try {
        const portalResponse = await fetch(`/api/guest/${encodeURIComponent(portalToken)}`, { cache: "no-store" });
        if (!portalResponse.ok) return;
        const portal = (await portalResponse.json()) as PortalPayload;
        const activity = bestActivityMatch(portal.reservation?.activities ?? [], drawer);
        if (!activity) return;

        const anchor = drawer.querySelector<HTMLButtonElement>("#guest-form-quick-add")
          ?? Array.from(drawer.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent?.trim() === "Resend Confirmation Email")
          ?? null;
        if (!anchor || drawer.querySelector("#damage-acknowledgment-quick-add")) return;

        const button = document.createElement("button");
        button.type = "button";
        button.id = "damage-acknowledgment-quick-add";
        button.textContent = "🛠️";
        styleButton(button);
        button.title = "Add Vehicle Damage Acknowledgment to My Epic Reservation";
        button.setAttribute("aria-label", "Add Vehicle Damage Acknowledgment to guest portal");
        anchor.insertAdjacentElement("afterend", button);

        const applyState = async () => {
          if (!document.body.contains(drawer) || !document.body.contains(button)) return;
          const response = await fetch(`/api/team/guest-forms/list?readinessId=${encodeURIComponent(activity.readinessId)}`, { cache: "no-store" });
          if (!response.ok) return;
          const data = (await response.json()) as { tasks?: GuestFormTask[] };
          const existing = (data.tasks ?? []).find((task) => task.templateKey === "damage_acknowledgment" && task.task_status !== "cancelled");

          drawer.querySelector("#damage-acknowledgment-signed-row")?.remove();
          button.onclick = null;
          button.disabled = false;
          button.textContent = "🛠️";
          button.style.opacity = "1";
          button.style.cursor = "pointer";
          button.style.background = "#fff";
          button.style.borderColor = "#c8d0d7";

          if (existing?.task_status === "completed") {
            button.style.background = "#fff8f3";
            button.style.borderColor = "#f0c7ae";
            button.title = existing.pdfReady ? "View signed Vehicle Damage Acknowledgment" : "Vehicle Damage Acknowledgment completed";
            if (existing.pdfReady && existing.documentUrl) {
              button.onclick = () => window.open(existing.documentUrl!, "_blank", "noopener,noreferrer");
              const row = makeSignedRow(existing.documentUrl);
              const guestRow = drawer.querySelector<HTMLElement>("#guest-form-signed-row");
              const cancellationCard = findCancellationCard(drawer);
              if (guestRow?.parentElement) {
                guestRow.insertAdjacentElement("afterend", row);
              } else if (cancellationCard?.parentElement) {
                cancellationCard.parentElement.insertBefore(row, cancellationCard);
              }
            } else {
              button.disabled = true;
              button.style.opacity = "0.72";
              button.style.cursor = "default";
            }
            return;
          }

          if (existing) {
            button.style.background = "#fffaf6";
            button.style.borderColor = "#efd7c5";
            button.title = "Vehicle Damage Acknowledgment is in My Epic Reservation";
            button.disabled = true;
            button.style.opacity = "0.78";
            button.style.cursor = "default";
            return;
          }

          button.onclick = async () => {
            if (!window.confirm("Add Vehicle Damage Acknowledgment to this guest's My Epic Reservation?")) return;
            button.disabled = true;
            button.textContent = "…";
            try {
              const create = await fetch("/api/team/guest-forms/create", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ readinessId: activity.readinessId, templateKey: "damage_acknowledgment" }),
              });
              const result = await create.json() as { error?: string };
              if (!create.ok) throw new Error(result.error || "Unable to add damage acknowledgment.");
              await applyState();
            } catch (error) {
              window.alert(error instanceof Error ? error.message : "Unable to add damage acknowledgment.");
              button.disabled = false;
              button.textContent = "🛠️";
            }
          };
        };

        await applyState();
        const timer = window.setInterval(() => void applyState(), 8000);
        timers.set(drawer, timer);
      } catch (error) {
        console.error("Damage acknowledgment action unavailable", error);
      } finally {
        delete drawer.dataset.damageAcknowledgmentEnhancing;
      }
    }

    void enhance();
    const observer = new MutationObserver(() => {
      for (const [drawer, timer] of timers) {
        if (!document.body.contains(drawer)) {
          window.clearInterval(timer);
          timers.delete(drawer);
        }
      }
      void enhance();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      for (const timer of timers.values()) window.clearInterval(timer);
      timers.clear();
    };
  }, []);

  return null;
}
