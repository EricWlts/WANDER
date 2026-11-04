import type { Layout, Photo } from "./types.ts";

/** Missing options preserve the original free, finite manual rail. */
export function railOptions(layout: Layout = {}) {
  return {
    single: layout.rail_mode === "single",
    loop: layout.rail_loop === true,
  };
}

export function railDestination(
  index: number,
  direction: number,
  count: number,
  loop: boolean,
) {
  if (count < 2) return 0;
  const next = index + direction;
  return loop
    ? ((next % count) + count) % count
    : Math.max(0, Math.min(count - 1, next));
}

/** Use viewport-relative offsets, including rails whose parent is an iframe. */
export function railIndex(left: number, starts: number[]) {
  if (!starts.length) return 0;
  return starts.reduce(
    (best, start, i) =>
      Math.abs(start - left) < Math.abs(starts[best] - left) ? i : best,
    0,
  );
}

/** Make the final real frame's start reachable without inserting duplicate frames. */
export function railTailSpace(viewport: number, lastFrame: number) {
  return Math.max(0, viewport - lastFrame);
}

/** A vertical or inward gesture always remains native scrolling. */
export function railBoundaryDirection(
  dx: number,
  dy: number,
  start: boolean,
  end: boolean,
  minimum = 40,
) {
  if (Math.abs(dx) <= minimum || Math.abs(dx) <= Math.abs(dy)) return 0;
  return dx < 0 && start ? -1 : dx > 0 && end ? 1 : 0;
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
