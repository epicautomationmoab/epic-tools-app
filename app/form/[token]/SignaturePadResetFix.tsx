"use client";

import { useEffect } from "react";

function resetCanvas(canvas: HTMLCanvasElement) {
  try {
    if (canvas.hasPointerCapture?.(1)) canvas.releasePointerCapture(1);
  } catch {
    // Pointer capture may already be released.
  }

  const width = canvas.width;
  const height = canvas.height;
  canvas.width = width;
  canvas.height = height;

  const ratio = Math.max(window.devicePixelRatio || 1, 1);
  const context = canvas.getContext("2d");
  if (!context) return;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.strokeStyle = "#1f2937";
  context.lineWidth = 2.2;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.beginPath();
}

export default function SignaturePadResetFix() {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const button = (event.target as HTMLElement | null)?.closest("button");
      if (!button || button.textContent?.trim() !== "Clear") return;
      const block = button.closest("div");
      const canvas = block?.parentElement?.querySelector("canvas");
      if (!(canvas instanceof HTMLCanvasElement)) return;

      // Let the form's own Clear handler reset React state first, then fully
      // replace the backing canvas so no active stroke/path can reappear.
      queueMicrotask(() => resetCanvas(canvas));
    };

    const onPointerLeave = (event: PointerEvent) => {
      const canvas = event.target;
      if (!(canvas instanceof HTMLCanvasElement)) return;
      if (!canvas.closest("form")) return;
      try {
        canvas.dispatchEvent(new PointerEvent("pointercancel", {
          bubbles: true,
          pointerId: event.pointerId,
          pointerType: event.pointerType,
          isPrimary: event.isPrimary,
        }));
      } catch {
        // Older browsers can omit synthetic PointerEvent support; Clear still works.
      }
    };

    document.addEventListener("click", onClick);
    document.addEventListener("pointerleave", onPointerLeave, true);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("pointerleave", onPointerLeave, true);
    };
  }, []);

  return null;
}
