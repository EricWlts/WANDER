import type { Photo } from "./types";

/** Containment preserves the complete motif, including single-image rail pages. */
export function canPanImage(photo: Photo | null) {
  return !!photo && photo.edits?.fit !== "contain";
}

/** Calm ceiling for the image shift (px), whatever strength was saved. */
export const maxParallaxShift = 40;
/** Small touch viewports get a gentler share of the shift. */
export const compactParallaxShare = 0.6;
/** Story cover: fixed strength (saved per-journey values are ignored) and ceiling of its shift in px.
    Overscan in Motion.tsx is intensity/2 + 8 = 83px per side, just above the full shift. */
export const coverParallaxIntensity = 150;
export const coverParallaxShift = 70;
/** Vertical shift for scroll progress -1..1; transform-only, never above the ceiling. */
export function parallaxShift(progress: number, intensity: number, compact = false) {
  const p = Math.max(-1, Math.min(1, Number.isFinite(progress) ? progress : 0));
  const cover = intensity >= coverParallaxIntensity;
  const ceiling = cover ? coverParallaxShift : maxParallaxShift;
  const reach = Math.min(Math.max(0, intensity) * 0.5, ceiling);
  if (cover) {
    // A cover leaves the screen at |p| of about 0.5: stretch that range and ease it in
    // (smoothstep) so the picture starts calmly and settles into the full shift.
    const q = Math.min(1, Math.abs(p) * 1.8);
    return Math.sign(p) * reach * q * q * (3 - 2 * q) * (compact ? compactParallaxShare : 1);
  }
  return p * reach * (compact ? compactParallaxShare : 1);
}
