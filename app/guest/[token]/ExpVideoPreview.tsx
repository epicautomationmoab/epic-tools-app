"use client";

import styles from "./ExpVideoPreview.module.css";

/**
 * EXP video integration preview. Do not activate before the training quiz,
 * rental pickup eligibility, and per-driver completion tracking ship.
 * NEXT_PUBLIC_EXP_VIDEO_PREVIEW must be explicitly enabled to render.
 */
export default function ExpVideoPreview() {
  return (
    <section className={styles.panel} aria-label="Epic Xpress Ready video preview">
      <div className={styles.head}>
        <span className={styles.eyebrow}>Internal integration preview — not a completed orientation</span>
        <h2>Epic Xpress Ready</h2>
        <p>Rental operations and safety orientation (version 3.2). This preview does not record completion or authorize checkout.</p>
      </div>
      <div className={styles.video}>
        <iframe
          src="https://player.vimeo.com/video/1239550688?autoplay=0&muted=0&loop=0"
          title="Epic 4X4 Rental Operations Video 3.2"
          allow="fullscreen; picture-in-picture; encrypted-media"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    </section>
  );
}
