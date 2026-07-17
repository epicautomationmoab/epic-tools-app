"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReadinessRow, VehicleBreakdownItem } from "@/lib/supabase";
import styles from "./ReadinessShell.module.css";

type Filter = "all" | "rental" | "tour";

function formatWallTime(value: string) {
  const match = value.match(/\d{4}-\d{2}-\d{2}[ T](\d{2}):(\d{2})/