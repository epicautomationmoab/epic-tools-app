"use client";

import { useEffect } from "react";

type CallRailCall = {
  id: string;
  at: string;
  direction: string;
  answered: boolean | null;
  voicemail: boolean | null;
  duration_seconds: number | null;
  caller_name: string | null;
  caller_phone: string | null;
  recording_url: string | null;
  summary: string | null;
  transcription: string | null;
  lead_explanation: string | null;
};

type CallRailResponse = { calls?: CallRailCall[] };

function normalizedText(element: Element | null) {
  return element?.textContent?.replace(/\s+/g, " ").trim().toLowerCase() || "";
}

function findConfirmation(drawer: Element) {
  for (const element of Array.from(drawer.querySelectorAll("*"))) {
    if (normalizedText(element) !== "booking confirmation") continue;
    const card = element.parentElement;
    if (!card) continue;
    const strong = card.querySelector("strong");
    const value = strong?.textContent?.trim();
    if (value) return value.toUpperCase();
  }
  return "";
}

function dateTimeLabel(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Denver",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function callLabel(call: CallRailCall) {
  if (call.voicemail) return "Voicemail";
  if (call.answered === false) return "Missed Call";
  return "Answered Call";
}

export default function CallRailActivityDrawerEnhancer() {
  useEffect(() => {
    let stopped = false;
    let scheduled = false;
    let activeConfirmation = "";
    let timer: number | null = null;

    function section(drawer: Element) {
      let existing = drawer.querySelector<HTMLElement>('[data-callrail-readiness-section="true"]');
      if (!existing) {
        existing = document.createElement("section");
        existing.dataset.callrailReadinessSection = "true";
        existing.style.margin = "22px 0 0";
        existing.style.padding = "16px 18px";
        existing.style.border = "1px solid #dde4ea";
        existing.style.borderRadius = "14px";
        existing.style.background = "#fff";
        drawer.appendChild(existing);
      } else if (existing.nextElementSibling) {
        drawer.appendChild(existing);
      }
      return existing;
    }

    function render(target: HTMLElement, calls: CallRailCall[], loading = false, error = "") {
      target.innerHTML = "";

      const header = document.createElement("div");
      header.style.display = "flex";
      header.style.alignItems = "center";
      header.style.justifyContent = "space-between";
      header.style.gap = "12px";

      const title = document.createElement("h3");
      title.textContent = "CallRail Activity";
      title.style.margin = "0";
      title.style.fontSize = "16px";
      header.appendChild(title);

      const live = document.createElement("span");
      live.textContent = "Live";
      live.style.fontSize = "11px";
      live.style.fontWeight = "800";
      live.style.color = "#788492";
      header.appendChild(live);
      target.appendChild(header);

      if (loading) {
        const message = document.createElement("div");
        message.textContent = "Loading…";
        message.style.marginTop = "10px";
        message.style.fontSize = "12px";
        message.style.color = "#6f7b88";
        target.appendChild(message);
        return;
      }

      if (error) {
        const message = document.createElement("div");
        message.textContent = error;
        message.style.marginTop = "10px";
        message.style.fontSize = "12px";
        message.style.color = "#a33a32";
        message.style.fontWeight = "700";
        target.appendChild(message);
        return;
      }

      if (!calls.length) {
        const message = document.createElement("div");
        message.textContent = "No linked CallRail activity.";
        message.style.marginTop = "10px";
        message.style.fontSize = "12px";
        message.style.color = "#7a8591";
        target.appendChild(message);
        return;
      }

      const list = document.createElement("div");
      list.style.display = "grid";
      list.style.gap = "8px";
      list.style.marginTop = "10px";

      for (const call of calls) {
        const details = document.createElement("details");
        details.style.border = "1px solid #dde4ea";
        details.style.borderRadius = "10px";
        details.style.background = "#f9fbfc";
        details.style.overflow = "hidden";

        const summary = document.createElement("summary");
        summary.style.display = "flex";
        summary.style.alignItems = "center";
        summary.style.justifyContent = "space-between";
        summary.style.gap = "12px";
        summary.style.padding = "11px 13px";
        summary.style.cursor = "pointer";
        summary.style.fontSize = "13px";
        summary.style.fontWeight = "800";
        summary.style.color = "#637182";

        const label = document.createElement("span");
        label.textContent = callLabel(call);
        summary.appendChild(label);

        const when = document.createElement("span");
        when.textContent = dateTimeLabel(call.at);
        summary.appendChild(when);
        details.appendChild(summary);

        const body = document.createElement("div");
        body.style.padding = "0 13px 13px";
        body.style.fontSize = "13px";
        body.style.lineHeight = "1.45";

        const detail = call.summary || call.lead_explanation || call.transcription;
        if (detail) {
          const text = document.createElement("div");
          text.textContent = detail;
          body.appendChild(text);
        } else {
          const text = document.createElement("div");
          text.textContent = "No CallRail summary or transcript available.";
          text.style.color = "#7a8591";
          body.appendChild(text);
        }

        if (call.recording_url) {
          const link = document.createElement("a");
          link.href = call.recording_url;
          link.target = "_blank";
          link.rel = "noreferrer";
          link.textContent = "Listen to recording ↗";
          link.style.display = "inline-block";
          link.style.marginTop = "8px";
          link.style.fontWeight = "800";
          body.appendChild(link);
        }

        details.appendChild(body);
        list.appendChild(details);
      }
      target.appendChild(list);
    }

    async function load(drawer: Element, confirmation: string, silent = false) {
      const target = section(drawer);
      if (!silent) render(target, [], true);
      try {
        const response = await fetch(`/api/team/readiness/callrail?confirmation=${encodeURIComponent(confirmation)}`, { cache: "no-store" });
        const body = (await response.json()) as CallRailResponse & { error?: string };
        if (!response.ok) throw new Error(body.error || "Unable to load CallRail activity.");
        if (stopped || confirmation !== activeConfirmation) return;
        render(target, body.calls || []);
        if (target.nextElementSibling) drawer.appendChild(target);
      } catch (error) {
        if (stopped || confirmation !== activeConfirmation || silent) return;
        render(target, [], false, error instanceof Error ? error.message : "Unable to load CallRail activity.");
      }
    }

    function enhance() {
      if (stopped) return;
      const drawer = document.querySelector('[role="dialog"]');
      if (!drawer) {
        activeConfirmation = "";
        if (timer) window.clearInterval(timer);
        timer = null;
        return;
      }

      const confirmation = findConfirmation(drawer);
      if (!confirmation) return;
      const target = section(drawer);
      if (confirmation === activeConfirmation && target.dataset.callrailLoaded === "true") return;

      activeConfirmation = confirmation;
      target.dataset.callrailLoaded = "true";
      void load(drawer, confirmation);
      if (timer) window.clearInterval(timer);
      timer = window.setInterval(() => {
        const currentDrawer = document.querySelector('[role="dialog"]');
        if (!currentDrawer || !activeConfirmation || document.visibilityState !== "visible") return;
        void load(currentDrawer, activeConfirmation, true);
      }, 5000);
    }

    function scheduleEnhance() {
      if (scheduled || stopped) return;
      scheduled = true;
      window.requestAnimationFrame(() => {
        scheduled = false;
        enhance();
      });
    }

    const observer = new MutationObserver(scheduleEnhance);
    observer.observe(document.body, { childList: true, subtree: true });
    scheduleEnhance();

    return () => {
      stopped = true;
      observer.disconnect();
      if (timer) window.clearInterval(timer);
    };
  }, []);

  return null;
}
