"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReadinessRow } from "@/lib/supabase";

type FilterKey = "all" | "attention" | "docs" | "balance" | "ohv" | "ready";

function formatWallTime(value: string) {
  const match = value.match(/\d{4}-\d{2}-\d{2}[ T](\d{2}):(\d{2})/);
  if (!match) return value;
  let hour = Number(match[1]);
  const minute = match[2];
  const suffix = hour >= 12 ? "PM" : "AM";
  hour = hour % 12 || 12;
  return `${hour}:${minute} ${suffix}`;
}

function formatDate(value: string) {
  const match = value.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return value;
  const date = new Date(`${match[2]}/${match[3]