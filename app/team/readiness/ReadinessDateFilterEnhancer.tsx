"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ReadinessRow } from "@/lib/supabase";

function visitDateKey(value: string) {
  return value.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] ?? "";
}

function formatSelectedDate(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return "Select Date";

  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function findTimeFilterGroup() {
  return document.querySelector('[aria-label="Time filters"]') as HTMLDivElement | null;
}

function findReadinessBody() {
  const table = document.querySelector('table');
  return table?.querySelector("tbody") as HTMLTableSectionElement | null;
}

export default function ReadinessDateFilterEnhancer({ rows }: { rows: ReadinessRow[] }) {
  const [target, setTarget] = useState<HTMLDivElement | null>(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [baseButtonClass, setBaseButtonClass] = useState("");
  const [activeButtonClass, setActiveButtonClass] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const suppressClearRef = useRef(false);

  const dateByConfirmation = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach((row) => {
      if (row.confirmation_code) {
        map.set(row.confirmation_code.trim().toUpperCase(), visitDateKey(row.visit_start_time));
      }
    });
    return map;
  }, [rows]);

  useEffect(() => {
    const group = findTimeFilterGroup();
    if (!group) return;

    setTarget(group);

    const buttons = Array.from(group.querySelectorAll("button"));
    const allButton = buttons.find((button) => button.textContent?.trim() === "All");
    const todayButton = buttons.find((button) => button.textContent?.trim() === "Today");

    if (allButton) setBaseButtonClass(allButton.className);
    if (allButton && todayButton) {
      const baseClasses = new Set(allButton.className.split(/\s+/).filter(Boolean));
      const activeOnly = todayButton.className
        .split(/\s+/)
        .filter(Boolean)
        .filter((name) => !baseClasses.has(name));
      setActiveButtonClass(activeOnly.join(" "));
    }
  }, []);

  useEffect(() => {
    const group = findTimeFilterGroup();
    if (!group) return;

    const onTimeFilterClick = (event: Event) => {
      const button = (event.target as HTMLElement).closest("button");
      if (!button || !group.contains(button)) return;
      if (button.dataset.readinessDateFilter === "true") return;

      if (suppressClearRef.current) {
        suppressClearRef.current = false;
        return;
      }

      setSelectedDate("");
    };

    group.addEventListener("click", onTimeFilterClick);
    return () => group.removeEventListener("click", onTimeFilterClick);
  }, [target]);

  useEffect(() => {
    const body = findReadinessBody();
    if (!body) return;

    const applyDateFilter = () => {
      const tableRows = Array.from(body.querySelectorAll("tr"));

      tableRows.forEach((tableRow) => {
        if (!selectedDate) {
          tableRow.style.removeProperty("display");
          return;
        }

        const rowText = tableRow.textContent?.toUpperCase() ?? "";
        let rowDate = "";

        for (const [confirmation, date] of dateByConfirmation) {
          if (rowText.includes(confirmation)) {
            rowDate = date;
            break;
          }
        }

        tableRow.style.display = rowDate === selectedDate ? "" : "none";
      });
    };

    applyDateFilter();

    const observer = new MutationObserver(applyDateFilter);
    observer.observe(body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      Array.from(body.querySelectorAll("tr")).forEach((row) => {
        row.style.removeProperty("display");
      });
    };
  }, [selectedDate, dateByConfirmation]);

  function openDatePicker() {
    const input = inputRef.current;
    if (!input) return;

    if (typeof input.showPicker === "function") {
      input.showPicker();
    } else {
      input.focus();
      input.click();
    }
  }

  function selectDate(value: string) {
    if (!value) return;

    const group = findTimeFilterGroup();
    const allButton = Array.from(group?.querySelectorAll("button") ?? []).find(
      (button) => button.textContent?.trim() === "All",
    ) as HTMLButtonElement | undefined;

    if (allButton) {
      suppressClearRef.current = true;
      allButton.click();
    }

    setSelectedDate(value);
  }

  if (!target) return null;

  const buttonClass = [baseButtonClass, selectedDate ? activeButtonClass : ""]
    .filter(Boolean)
    .join(" ");

  return createPortal(
    <>
      <button
        type="button"
        className={buttonClass}
        data-readiness-date-filter="true"
        onClick={openDatePicker}
        aria-label={selectedDate ? `Selected date ${formatSelectedDate(selectedDate)}` : "Select date"}
      >
        {selectedDate ? formatSelectedDate(selectedDate) : "Select Date"}
      </button>
      <input
        ref={inputRef}
        type="date"
        value={selectedDate}
        onChange={(event) => selectDate(event.target.value)}
        aria-label="Select readiness date"
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          opacity: 0,
          pointerEvents: "none",
        }}
      />
    </>,
    target,
  );
}
