"use client";

import { useEffect } from "react";

function supabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase configuration is missing.");
  return { url, key };
}

async function saveContactOverride(
  confirmationCode: string,
  field: "email" | "phone",
  value: string,
) {
  const { url, key } = supabaseConfig();
  const body = {
    p_confirmation_code: confirmationCode,
    p_effective_email: field === "email" ? value : null,
    p_effective_phone: field === "phone" ? value : null,
    p_updated_by: "EpicTools",
    p_change_reason: "Updated by team from Guest Readiness drawer",
  };

  const response = await fetch(`${url}/rest/v1/rpc/update_guest_contact_override`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || "Unable to save guest contact information.");
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
      if (target.textContent?.trim() !== "Save") return;

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

      const field: "email" | "phone" = input.type === "email" ? "email" : "phone";
      const value = input.value.trim();
      if (!value) {
        window.alert(`Enter a ${field} before saving.`);
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      target.disabled = true;
      const originalLabel = target.textContent;
      target.textContent = "Saving...";

      try {
        await saveContactOverride(confirmationCode, field, value);
        target.textContent = "Saved ✓";
        window.setTimeout(() => window.location.reload(), 450);
      } catch (error) {
        target.disabled = false;
        target.textContent = originalLabel || "Save";
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
