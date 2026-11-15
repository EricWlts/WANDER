import type { Photo } from "./types.ts";

export function railIndex(index: number, count: number) {
  return count ? ((index % count) + count) % count : 0;
}

/** Copies flank the real slides so either seam can be traversed in one step. */
export const railEdgeCopies = 3;

export function railDirection(x: number, y: number, threshold: number) {
  return Math.abs(x) >= threshold && Math.abs(x) > Math.abs(y) * 1.2
    ? Math.sign(x)
    : 0;
}

/** Whole-image pages bypass the saved crop only for display; lightbox receives the original. */
export function railPhoto(photo: Photo, single: boolean): Photo {
  return single
    ? {
        ...photo,
        edits: {
          ...photo.edits,
          fit: "contain",
          ratio: "original",
          zoom: 1,
          x: 50,
          y: 50,
          hover_zoom: 0,
        },
      }
    : photo;
}

/**
 * Where a photograph rests once the rail has scrolled to it: horizontally
 * centred in the viewport, vertically unchanged. Layout sizes only, so it is
 * exact even while the rail is still gliding.
 */
export function railRestRect(
  viewport: { left: number; width: number },
  frame: { top: number; width: number; height: number },
) {
  return {
    left: viewport.left + (viewport.width - frame.width) / 2,
    top: frame.top,
    width: frame.width,
    height: frame.height,
  };
}

/** The rail follows the viewer only when both list the same photographs. */
export function railFollows(segments: number, photos: number, current: number, wanted: number) {
  return segments > 0 && segments === photos && current === railIndex(wanted, photos);
}

/** What moved the rail: a finger, a mouse/pen drag, or keys, buttons and the wheel. */
export type RailInput = "touch" | "mouse" | "key";

export const railTouchDuration = { min: 450, max: 600 };
export const railMouseDuration = 700;

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

/**
 * Glide time after a navigation. A finger that is already moving gets a short
 * 450–600 ms settle (faster flick, shorter glide); mouse drags,
 * keys, buttons and the wheel keep the calm 700 ms.
 */
export function railDuration(input: RailInput, speed = 0) {
  if (input !== "touch") return railMouseDuration;
  const { min, max } = railTouchDuration;
  return Math.round(clamp(max - Math.abs(speed) * 150, min, max));
}

/** Pointer samples are `shift` values: start − current, so positive means "towards the next photograph". */
export type RailSample = { time: number; shift: number };

export const railVelocityWindow = 100;

/**
 * Release speed in px/ms from the samples of the last `railVelocityWindow` ms.
 * A finger that rested before lifting (newest sample older than the window)
 * has no momentum.
 */
export function railVelocity(samples: readonly RailSample[], now: number) {
  const recent = samples.filter((sample) => now - sample.time <= railVelocityWindow);
  if (recent.length < 2) return 0;
  const first = recent[0];
  const last = recent[recent.length - 1];
  const span = last.time - first.time;
  return span > 0 ? (last.shift - first.shift) / span : 0;
}

/**
 * Track offset while dragging. The finger is followed 1:1 after the small
 * dead zone that decided the axis (so the track does not jump), up to one
 * slot; beyond that the track resists, because a single gesture never
 * travels further than the neighbouring photograph.
 */
export function railDragOffset(shift: number, slot: number, slop = 0) {
  const sign = shift < 0 ? -1 : 1;
  const travelled = Math.max(0, Math.abs(shift) - slop);
  const free = Math.max(0, slot);
  if (travelled <= free) return -sign * travelled;
  return -sign * (free + (travelled - free) * 0.3);
}

export const railFlickSpeed = 0.3;
export const railFlickMinimum = 12;

/** Distance that carries a slow drag to the next photograph. */
export function railStepDistance(slot: number) {
  return clamp(slot * 0.15, 28, 56);
}

/**
 * Decide where a released drag rests: -1, 0 (snap back) or 1 photograph.
 * A quick flick or a long enough drag steps; the flick's direction wins.
 */
export function railRelease(shift: number, velocity: number, slot: number) {
  const flick = Math.abs(velocity) >= railFlickSpeed && Math.abs(shift) >= railFlickMinimum;
  if (flick) return Math.sign(velocity) || Math.sign(shift);
  return Math.abs(shift) >= railStepDistance(slot) ? Math.sign(shift) : 0;
}

/**
 * Keys that move a focused carousel. Modified keys (browser back is Alt+←),
 * form fields and handled events are left alone.
 */
export function railKeyAction(
  key: string,
  count: number,
  context: { editable?: boolean; modified?: boolean } = {},
): { step: number } | { index: number } | null {
  if (count < 2 || context.editable || context.modified) return null;
  switch (key) {
    case "ArrowLeft": return { step: -1 };
    case "ArrowRight": return { step: 1 };
    case "Home": return { index: 0 };
    case "End": return { index: count - 1 };
    default: return null;
  }
}
