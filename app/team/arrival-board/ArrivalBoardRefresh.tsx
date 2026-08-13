"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ArrivalBoardRefresh() {
  const router = useRouter();

  useEffect(() => {
    const interval = window.setInterval(() => {
      router.refresh();
    }, 30000);

    return () => window.clearInterval(interval);
  }, [router]);

  return null;
}
