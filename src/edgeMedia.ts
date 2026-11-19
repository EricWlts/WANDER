// Pure logic for „Bis zum Rand“ (layout.edge_to_edge): photographs of one format run edge to edge.
import type { Layout, Photo } from "./types.ts";
import { effectivePhotoRatio } from "./storyLayout.ts";

/** Modules that show several photographs next to each other (not the running row / carousel). */
export const EDGE_KINDS: readonly string[] = ["pair", "wall", "gallery"];

/** Two ratios count as one format within this relative tolerance. */
export const EDGE_TOLERANCE = 0.02;

/** Frame ratio of a photograph as the module shows it (module crop `layout.ratio` wins over the photograph's own). */
export function edgePhotoRatio(photo: Photo, layout: Layout = {}): number {
  const framed =
    layout.ratio && layout.ratio !== "original"
      ? { ...photo, edits: { ...photo.edits, ratio: layout.ratio } }
      : photo;
  return effectivePhotoRatio(framed);
}

/** True for two or more photographs that all share one aspect ratio. */
export function sameFormat(ratios: readonly number[], tolerance = EDGE_TOLERANCE): boolean {
  if (ratios.length < 2 || ratios.some((r) => !(r > 0) || !Number.isFinite(r))) return false;
  const min = Math.min(...ratios);
  const max = Math.max(...ratios);
  return max / min - 1 <= tolerance;
}

/** Whether the editor offers „Bis zum Rand“ for this module. */
export function edgeToEdgeAvailable(kind: string, photos: readonly Photo[], layout: Layout = {}): boolean {
  return EDGE_KINDS.includes(kind) && sameFormat(photos.map((p) => edgePhotoRatio(p, layout)));
}

/** Whether the module is actually rendered edge to edge (setting on and formats still match). */
export function edgeToEdgeActive(kind: string, photos: readonly Photo[], layout: Layout = {}): boolean {
  return layout.edge_to_edge === true && edgeToEdgeAvailable(kind, photos, layout);
}

/** Photographs per row: one row up to four, otherwise rows of near-equal length. Mobile: portraits stay side by side. */
export function edgeColumns(count: number, ratio: number): { desktop: number; mobile: number } {
  const desktop = count <= 4 ? count : Math.ceil(count / Math.ceil(count / 4));
  const portrait = ratio < 1;
  const mobile = portrait ? Math.min(desktop, count <= 3 ? count : 2) : 1;
  return { desktop: Math.max(1, desktop), mobile: Math.max(1, mobile) };
}
