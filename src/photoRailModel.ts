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

export interface RailWheelBurst {
  time: number;
  axis?: "x" | "y";
  distance: number;
  stepped: boolean;
}

export function railWheel(
  previous: RailWheelBurst, time: number, x: number, y: number,
) {
  const burst = time - previous.time > 220
    ? { time, axis: undefined, distance: 0, stepped: false }
    : { ...previous, time };
  if (!burst.axis) {
    if (railDirection(x, y, 1)) burst.axis = "x";
    else if (Math.abs(y) >= 1) burst.axis = "y";
  }
  if (burst.axis !== "x") return { burst, direction: 0, consume: false };
  const consume = Math.abs(x) > Math.abs(y);
  if (consume && !burst.stepped) burst.distance += x;
  const direction = burst.stepped ? 0 : railDirection(burst.distance, 0, 32);
  if (direction) burst.stepped = true;
  return { burst, direction, consume };
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
