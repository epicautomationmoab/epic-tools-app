"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReadinessRow } from "@/lib/supabase";

type FilterKey = "all" | "attention" | "docs" | "balance" | "ohv" | "ready";

function formatWallTime(value: string) {
  const match = value.match(/\d{4}-\d{2}-\d{2}[ T](\d{2}):(\d{2})/);
  if (!match) return value;
  let hour = Number(match