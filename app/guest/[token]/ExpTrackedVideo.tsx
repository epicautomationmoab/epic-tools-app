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
  useEffect(() => { callback.current = onCoverageChange; }, [onCoverageChange]);

  useEffect(() => {
    const frameWindow = frame.current?.contentWindow;
    if (!frameWindow) return;
    const subscribe = () => {
      frameWindow.postMessage(JSON.stringify({ method: "addEventListener", value: "timeupdate" }), "https://player.vimeo.com");
      frameWindow.postMessage(JSON.stringify({ method: "addEventListener", value: "seeked" }), "https://player.vimeo.com");
    };
    function onMessage(event: MessageEvent) {
      if (event.origin !== "https://player.vimeo.com" || event.source !== frameWindow) return;
      let message: { event?: string; data?: { seconds?: number; duration?: number } };
      try { message = typeof event.data === "string" ? JSON.parse(event.data) : event.data; } catch { return; }
      if (!message || typeof message !== "object") return;
      if (message.event === "ready") { subscribe(); return; }
      if (message.event === "seeked") { previous.current = null; return; }
      if (message.event !== "timeupdate") return;
      const data = message.data;
      if (!data || !Number.isFinite(data.seconds) || !Number.isFinite(data.duration) || !data.duration || data.duration < 1) return;
      const seconds = Math.max(0, data.seconds!);
      const duration = data.duration!;
      const last = previous.current;
      previous.current = seconds;
      if (last !== null) {
        const delta = seconds - last;
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
    }
    window.addEventListener("message", onMessage);
    subscribe();
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return <>
    <div className={styles.video}>
      <iframe ref={frame} src={VIDEO_URL} title="Epic 4X4 Rental Operations Video 3.2"
        allow="fullscreen; picture-in-picture; encrypted-media" allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin" />
    </div>
    <p className={styles.videoProgress} role="status">
      {coverage >= 90 ? "Video requirement met — 90% watched." :
        `Video watched: ${coverage}% · Watch at least 90% to continue.`}
    </p>
  </>;
}
