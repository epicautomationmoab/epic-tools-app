"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./ExpVideoPreview.module.css";

const VIDEO_URL = "https://player.vimeo.com/video/1239550688?autoplay=0&muted=0&loop=0&title=0&byline=0&portrait=0";
const REQUIRED_COVERAGE = 0.9;
const SEGMENT_SECONDS = 1;

/** Each timeupdate represents observed playback, not a playhead position.
 * Advancing by a large amount (seeking/skipping) earns no coverage. */
export default function ExpTrackedVideo({ onCoverageChange }: { onCoverageChange: (complete: boolean) => void }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const callback = useRef(onCoverageChange);
  const visited = useRef(new Set<number>());
  const previous = useRef<number | null>(null);
  const [coverage, setCoverage] = useState(0);
  const [error, setError] = useState(false);
  useEffect(() => { callback.current = onCoverageChange; }, [onCoverageChange]);

  useEffect(() => {
    let cancelled = false;
    let player: { on: (event: string, handler: (data: { seconds?: number; duration?: number }) => void) => void; destroy: () => Promise<void> } | undefined;
    // Lazy-load the Vimeo SDK only when the video player is mounted.
    // No Vimeo API token or service-side Vimeo credentials are required.
    void import("@vimeo/player").then(({ default: Player }) => {
      if (cancelled || !frame.current) return;
      player = new Player(frame.current);
      player.on("timeupdate", data => {
        if (!Number.isFinite(data.seconds) || !Number.isFinite(data.duration) || !data.duration || data.duration < 1) return;
        const seconds = Math.max(0, data.seconds!);
        const duration = data.duration!;
        const last = previous.current;
        previous.current = seconds;
        if (last !== null) {
          const delta = seconds - last;
          // Vimeo normally reports timeupdate approximately every 250ms.
          // Ignore backward travel, seeks, and unusually large timestamp jumps.
          if (delta > 0 && delta <= 1.5) {
            const first = Math.floor(last / SEGMENT_SECONDS);
            const final = Math.floor(Math.min(seconds, duration - 0.001) / SEGMENT_SECONDS);
            for (let i = first; i <= final; i++) visited.current.add(i);
          }
        }
        const count = Math.ceil(duration / SEGMENT_SECONDS);
        const value = Math.min(1, visited.current.size / count);
        setCoverage(Math.round(value * 100));
        if (value >= REQUIRED_COVERAGE) callback.current(true);
      });
      player.on("seeked", () => { previous.current = null; });
    }).catch(() => { if (!cancelled) setError(true); });
    return () => {
      cancelled = true;
      if (player) void player.destroy().catch(() => undefined);
    };
  }, []);

  return <>
    <div className={styles.video}>
      <iframe ref={frame} src={VIDEO_URL} title="Epic 4X4 Rental Operations Video 3.2"
        allow="fullscreen; picture-in-picture; encrypted-media" allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin" />
    </div>
    <p className={styles.videoProgress} role="status">
      {error ? "Video progress tracking is unavailable. Please complete orientation with an Adventure Technician." :
        coverage >= 90 ? "Video requirement met — 90% watched." :
        `Video watched: ${coverage}% · Watch at least 90% to continue.`}
    </p>
  </>;
}
