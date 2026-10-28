"use client";

import { useEffect, useRef, useState } from "react";
import {beltTireCueReached} from "@/lib/exp/belt-tire-inquiry";
import styles from "./ExpVideoPreview.module.css";

const VIDEO_URL = "https://player.vimeo.com/video/1239550688?autoplay=0&muted=0&loop=0&title=0&byline=0&portrait=0";
const REQUIRED_COVERAGE = 0.98;

type PlaybackEvent = { seconds: number; duration: number };
type Player = {
  on: (event: string, handler: (data: PlaybackEvent) => void) => void;
  off: (event: string, handler: (data: PlaybackEvent) => void) => void;
  ready: () => Promise<void>;
  destroy: () => Promise<void>;
};
type VimeoWindow = Window & { Vimeo?: { Player: new (iframe: HTMLIFrameElement) => Player } };
let sdkLoading: Promise<void> | null = null;
function loadVimeoSdk(): Promise<void> {
  if ((window as VimeoWindow).Vimeo?.Player) return Promise.resolve();
  if (sdkLoading) return sdkLoading;
  sdkLoading = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://player.vimeo.com/api/player.js";
    script.async = true;
    script.onload = () => (window as VimeoWindow).Vimeo?.Player ? resolve() : reject(new Error("Vimeo SDK unavailable"));
    script.onerror = () => reject(new Error("Vimeo SDK could not load"));
    document.head.appendChild(script);
  }).catch(error => { sdkLoading = null; throw error; });
  return sdkLoading;
}

/** Track watched seconds, not the video seek position. */
export type ExpPlaybackCheckpoint = { watchedSeconds: number[]; durationSeconds: number; ended: boolean };
export default function ExpTrackedVideo({ onCoverageChange, onCheckpoint, initialCheckpoint, onInquiryAvailable }: { onInquiryAvailable?:()=>void; initialCheckpoint?: ExpPlaybackCheckpoint; onCoverageChange: (complete: boolean) => void; onCheckpoint?: (data: ExpPlaybackCheckpoint) => void }) {
  const inquiryCallback=useRef(onInquiryAvailable);
  useEffect(()=>{inquiryCallback.current=onInquiryAvailable},[onInquiryAvailable]);
  const frame = useRef<HTMLIFrameElement>(null);
  const callback = useRef(onCoverageChange);
  const checkpointCallback = useRef(onCheckpoint);
  const [coverage, setCoverage] = useState(initialCheckpoint ? Math.min(100,Math.round(initialCheckpoint.watchedSeconds.length/initialCheckpoint.durationSeconds*100)) : 0);
  const [trackingError, setTrackingError] = useState(false);
  useEffect(() => { callback.current = onCoverageChange; }, [onCoverageChange]);
  useEffect(() => { checkpointCallback.current = onCheckpoint; }, [onCheckpoint]);
  useEffect(() => {
    let disposed = false;
    let inquiryPublished=false;
    const publishInquiry=(position:number)=>{if(!inquiryPublished&&beltTireCueReached(position,initialCheckpoint?.watchedSeconds)){inquiryPublished=true;inquiryCallback.current?.()}};
    publishInquiry(0);
    let player: Player | null = null;
    const watched = new Set<number>(initialCheckpoint?.watchedSeconds??[]);
    let previous: number | null = null;
    let seeking = false;
    let reachedEnd = initialCheckpoint?.ended??false;
    let lastCheckpointSize = 0;
    const publishCheckpoint = (duration: number, force = false) => {
      if (duration <= 0 || (!force && watched.size - lastCheckpointSize < 15)) return;
      lastCheckpointSize = watched.size;
      checkpointCallback.current?.({watchedSeconds: Array.from(watched), durationSeconds: Math.ceil(duration), ended: reachedEnd});
    };
    const checkComplete = (duration: number) => {
      if (reachedEnd && watched.size >= Math.ceil(duration) * REQUIRED_COVERAGE) callback.current(true);
    };
    const onEnded = () => {
      reachedEnd = true;
      if (knownDuration > 0 && previous !== null) {
        const lastSecond = Math.ceil(knownDuration) - 1;
        if (knownDuration - previous <= 2) watched.add(lastSecond);
        checkComplete(knownDuration);
        publishCheckpoint(knownDuration, true);
      }
    };
    let knownDuration = initialCheckpoint?.durationSeconds??0;
    const onSeeking = () => { seeking = true; previous = null; };
    const onSeeked = () => { seeking = false; previous = null; };
    const onTimeUpdate = (data: PlaybackEvent) => {
      if (!Number.isFinite(data.seconds) || !Number.isFinite(data.duration) || data.duration <= 0) return;
      const current = Math.max(0, Math.min(data.seconds, data.duration));
      knownDuration = data.duration;
      publishInquiry(current);
      if (!seeking && previous !== null) {
        const elapsed = current - previous;
        if (elapsed > 0 && elapsed <= 2) {
          const from = Math.floor(previous);
          const to = Math.floor(Math.min(current, data.duration - 0.001));
          for (let second = from; second <= to; second++) watched.add(second);
        }
      }
      previous = current;
      const percent = Math.min(1, watched.size / Math.ceil(data.duration));
      setCoverage(Math.round(percent * 100));
      checkComplete(data.duration);
      publishCheckpoint(data.duration);
    };
    void loadVimeoSdk().then(async () => {
      if (disposed || !frame.current) return;
      const Vimeo = (window as VimeoWindow).Vimeo;
      if (!Vimeo?.Player) throw new Error("Player SDK unavailable");
      player = new Vimeo.Player(frame.current);
      player.on("seeking", onSeeking);
      player.on("seeked", onSeeked);
      player.on("timeupdate", onTimeUpdate);
      player.on("ended", onEnded);
      await player.ready();
      if (!disposed) setTrackingError(false);
    }).catch(() => { if (!disposed) setTrackingError(true); });
    return () => {
      publishCheckpoint(knownDuration,true);
      disposed = true;
      if (player) {
        player.off("seeking", onSeeking);
        player.off("seeked", onSeeked);
        player.off("timeupdate", onTimeUpdate);
        player.off("ended", onEnded);
        // Keep the iframe instance under React ownership; do not destroy it.
      }
    };
  }, []);

  return <>
    <div className={styles.video}>
      <iframe ref={frame} src={VIDEO_URL} title="Epic 4X4 Rental Operations Video 3.2"
        allow="fullscreen; picture-in-picture; encrypted-media" allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin" />
    </div>
    <p className={styles.videoProgress} role="status">
      {coverage >= 100 ? "Video viewing complete." :
        `Video watched: ${coverage}% · Complete the video to continue.`}
    </p>
    {trackingError ? <p role="alert">Video tracking could not connect. Please let our team know; you won't be marked complete by watching alone.</p> : null}
  </>;
}
