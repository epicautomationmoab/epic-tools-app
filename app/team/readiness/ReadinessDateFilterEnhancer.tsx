"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ReadinessRow } from "@/lib/supabase";

function visitDateKey(value: string) {
  return value.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] ?? "";
}

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateFromKey(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function formatSelectedDate(value: string) {
  const date = dateFromKey(value);
  if (!date) return "Select Date";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatMonth(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(value);
}

function startOfMonth(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

function addMonths(value: Date, amount: number) {
  return new Date(value.getFullYear(), value.getMonth() + amount, 1);
}

function calendarDays(month: Date) {
  const first = startOfMonth(month);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

function findTimeFilterGroup() {
  return document.querySelector('[aria-label="Time filters"]') as HTMLDivElement | null;
}

function findReadinessBody() {
  const tables = Array.from(document.querySelectorAll("table"));
  const readinessTable = tables.find((table) => {
    const headings = Array.from(table.querySelectorAll("thead th"))
      .map((heading) => heading.textContent?.trim())
      .filter(Boolean);

    return headings.includes("Visit") && headings.includes("Guest") && headings.includes("Activity");
  });

  return readinessTable?.querySelector("tbody") as HTMLTableSectionElement | null;
}

export default function ReadinessDateFilterEnhancer({ rows }: { rows: ReadinessRow[] }) {
  const [target, setTarget] = useState<HTMLDivElement | null>(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(new Date()));
  const [baseButtonClass, setBaseButtonClass] = useState("");
  const [activeButtonClass, setActiveButtonClass] = useState("");
  const suppressClearRef = useRef(false);
  const pickerRef = useRef<HTMLDivElement | null>(null);

  const dateByConfirmation = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach((row) => {
      if (row.confirmation_code) {
        map.set(row.confirmation_code.trim().toUpperCase(), visitDateKey(row.visit_start_time));
      }
    });
    return map;
  }, [rows]);

  const days = useMemo(() => calendarDays(visibleMonth), [visibleMonth]);
  const todayKey = dateKey(new Date());

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

      setCalendarOpen(false);

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
    if (!calendarOpen) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) {
        setCalendarOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setCalendarOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [calendarOpen]);

  useEffect(() => {
    if (!selectedDate || !activeButtonClass) return;

    const group = findTimeFilterGroup();
    const allButton = Array.from(group?.querySelectorAll("button") ?? []).find(
      (button) => button.textContent?.trim() === "All",
    );

    activeButtonClass
      .split(/\s+/)
      .filter(Boolean)
      .forEach((className) => allButton?.classList.remove(className));
  }, [selectedDate, activeButtonClass]);

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

  function toggleCalendar() {
    setCalendarOpen((open) => {
      const next = !open;
      if (next) {
        const selected = dateFromKey(selectedDate);
        setVisibleMonth(startOfMonth(selected ?? new Date()));
      }
      return next;
    });
  }

  function selectDate(value: string) {
    const group = findTimeFilterGroup();
    const allButton = Array.from(group?.querySelectorAll("button") ?? []).find(
      (button) => button.textContent?.trim() === "All",
    ) as HTMLButtonElement | undefined;

    if (allButton) {
      suppressClearRef.current = true;
      allButton.click();
    }

    setSelectedDate(value);
    setCalendarOpen(false);
  }

  if (!target) return null;

  const buttonClass = [baseButtonClass, selectedDate ? activeButtonClass : ""]
    .filter(Boolean)
    .join(" ");

  return createPortal(
    <div ref={pickerRef} style={{ position: "relative", display: "inline-flex" }}>
      <button
        type="button"
        className={buttonClass}
        data-readiness-date-filter="true"
        onClick={toggleCalendar}
        aria-haspopup="dialog"
        aria-expanded={calendarOpen}
        aria-label={selectedDate ? `Selected date ${formatSelectedDate(selectedDate)}` : "Select date"}
      >
        {selectedDate ? formatSelectedDate(selectedDate) : "Select Date"}
      </button>

      {calendarOpen ? (
        <div
          role="dialog"
          aria-label="Select readiness date"
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            left: 0,
            zIndex: 1000,
            width: 292,
            padding: 14,
            border: "1px solid #dfe4e9",
            borderRadius: 12,
            background: "#fff",
            boxShadow: "0 12px 30px rgba(15, 23, 42, 0.18)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <strong style={{ fontSize: 14, color: "#202733" }}>{formatMonth(visibleMonth)}</strong>
            <div style={{ display: "flex", gap: 4 }}>
              <button
                type="button"
                onClick={() => setVisibleMonth((month) => addMonths(month, -1))}
                aria-label="Previous month"
                style={{ width: 34, height: 34, border: 0, borderRadius: 8, background: "transparent", fontSize: 20, cursor: "pointer" }}
              >
                ‹
              </button>
              <button
                type="button"
                onClick={() => setVisibleMonth((month) => addMonths(month, 1))}
                aria-label="Next month"
                style={{ width: 34, height: 34, border: 0, borderRadius: 8, background: "transparent", fontSize: 20, cursor: "pointer" }}
              >
                ›
              </button>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3, marginBottom: 4 }}>
            {["S", "M", "T", "W", "T", "F", "S"].map((label, index) => (
              <div key={`${label}-${index}`} style={{ textAlign: "center", fontSize: 11, fontWeight: 800, color: "#7a8490", padding: "4px 0" }}>
                {label}
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3 }}>
            {days.map((day) => {
              const key = dateKey(day);
              const isCurrentMonth = day.getMonth() === visibleMonth.getMonth();
              const isSelected = key === selectedDate;
              const isToday = key === todayKey;

              return (
                <button
                  type="button"
                  key={key}
                  onClick={() => selectDate(key)}
                  aria-label={new Intl.DateTimeFormat("en-US", { dateStyle: "full" }).format(day)}
                  aria-pressed={isSelected}
                  style={{
                    height: 34,
                    border: isToday && !isSelected ? "1px solid #ff6b1a" : "1px solid transparent",
                    borderRadius: 8,
                    background: isSelected ? "#ff6b1a" : "transparent",
                    color: isSelected ? "#fff" : isCurrentMonth ? "#202733" : "#a7afb8",
                    fontWeight: isSelected || isToday ? 800 : 600,
                    cursor: "pointer",
                    fontSize: 13,
                  }}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, paddingTop: 10, borderTop: "1px solid #edf0f3" }}>
            <button
              type="button"
              onClick={() => selectDate(todayKey)}
              style={{ border: 0, background: "transparent", color: "#1769aa", fontWeight: 800, cursor: "pointer", padding: "6px 4px" }}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setCalendarOpen(false)}
              style={{ border: 0, background: "transparent", color: "#5f6a76", fontWeight: 800, cursor: "pointer", padding: "6px 4px" }}
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>,
    target,
  );
}
