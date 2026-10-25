"use client";

import { useEffect } from "react";

async function saveContactOverride(
  confirmationCode: string,
  field: "email" | "phone",
  value: string,
) {
  const response = await fetch("/api/team/readiness/contact-override", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ confirmation_code: confirmationCode, field, value }),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || "Unable to save guest contact information.");
  }
}

function confirmationCodeFromDrawer(drawer: HTMLElement) {
  const strongValues = Array.from(drawer.querySelectorAll("strong"))
    .map((node) => node.textContent?.trim() ?? "")
    .filter(Boolean);

  return strongValues.find((value) => /^[A-Z0-9]{4}-[A-Z0-9]{4}$/i.test(value)) ?? null;
}

export default function ContactSaveEnhancer() {
  useEffect(() => {
    const handleClick = async (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLButtonElement)) return;

      const contactField = target.dataset.contactSaveField;
      if (contactField !== "email" && contactField !== "phone") return;

      const editRow = target.parentElement;
      const input = editRow?.querySelector("input");
      if (!(input instanceof HTMLInputElement)) return;

      const drawer = target.closest('[role="dialog"]');
      if (!(drawer instanceof HTMLElement)) return;

      const confirmationCode = confirmationCodeFromDrawer(drawer);
      if (!confirmationCode) {
        window.alert("Unable to identify this reservation. Nothing was changed.");
        return;
      }

      const field: "email" | "phone" = contactField;
      const value = input.value.trim();
      if (!value) {
        window.alert(`Enter a ${field} before saving.`);
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      target.disabled = true;
      const originalLabel = target.textContent || "Save";
      target.textContent = "Saving...";

      try {
        await saveContactOverride(confirmationCode, field, value);
        target.textContent = "Saved ✓";

        window.dispatchEvent(new CustomEvent("readiness-contact-saved", {
          detail: { confirmationCode, field, value },
        }));

        window.setTimeout(() => {
          target.disabled = false;
          target.textContent = originalLabel;
        }, 1200);
      } catch (error) {
        target.disabled = false;
        target.textContent = originalLabel;
        window.alert(
          error instanceof Error ? error.message : "Unable to save guest contact information.",
        );
      }
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, []);

  return null;
}
