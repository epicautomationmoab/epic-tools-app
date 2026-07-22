"use client";

import { useEffect, useState } from "react";

const SYNC_EVENT = "epic-readiness-synced";

function formatElapsed(seconds: number) {
  if (seconds < 2) return "just now";
  if (seconds === 1) return "1 second ago";
  return `${seconds} seconds ago`;
}

export default function LastSynced() {
  const [lastSyncedAt, setLastSyncedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    function markSynced() {
      const timestamp = Date.now();
      setLastSyncedAt(timestamp);
      setNow(timestamp);
    }

    const intervalId = window.setInterval(() => setNow(Date.now()), 1_000);
    window.addEventListener(SYNC_EVENT, markSynced);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener(SYNC_EVENT, markSynced);
    };
  }, []);

  const elapsedSeconds = Math.max(
    0,
    Math.floor((now - lastSyncedAt) / 1_000),
  );

  return (
    <div>
      Last synced
      <br />
      {formatElapsed(elapsedSeconds)}
    </div>
  );
}
