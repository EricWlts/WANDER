/* Shared pieces of the mountain W: path data, the stroke order for the drawn construction and the timing of
   "the W becomes a window" (the flight into the studio / the editor). Pure data and maths, no DOM. */

export const W_PATH =
  "M 995.10,4.90 L 818.63,4.90 L 882.35,39.22 L 887.25,78.43 L 754.90,372.55 L 534.31,0.00 L 348.04,357.84 L 205.88,68.63 L 210.78,29.41 L 259.80,4.90 L 0.00,4.90 L 68.63,49.02 L 289.22,514.71 L 421.57,269.61 L 441.18,279.41 L 490.20,176.47 L 553.92,303.92 L 578.43,269.61 L 720.59,514.71 L 916.67,73.53 L 955.88,24.51 Z";
export const W_RIDGE =
  "M 289.22,514.71 L 421.57,269.61 L 441.18,279.41 L 490.20,176.47 L 553.92,303.92 L 578.43,269.61 L 720.59,514.71";

/** Viewbox of the mark: -20 -20 1035 555. */
export const W_VIEW = { x: -20, y: -20, w: 1035, h: 555 };
/** The widest point inside the letter (inscribed circle): the window grows around it, so the letter covers the screen at the end. */
export const W_ANCHOR = { x: 577, y: 202, r: 66 };

/** The outline as strokes that all start at the baseline and climb: first the ridge, then both flanks to the summit. */
export const W_STROKES: Array<{ d: string; start: number; end: number }> = [
  { d: W_RIDGE, start: 0, end: 0.38 },
  {
    d: "M 289.22,514.71 L 68.63,49.02 L 0.00,4.90 L 259.80,4.90 L 210.78,29.41 L 205.88,68.63 L 348.04,357.84 L 534.31,0.00",
    start: 0.2,
    end: 1,
  },
  {
    d: "M 720.59,514.71 L 916.67,73.53 L 955.88,24.51 L 995.10,4.90 L 818.63,4.90 L 882.35,39.22 L 887.25,78.43 L 754.90,372.55 L 534.31,0.00",
    start: 0.2,
    end: 1,
  },
];

/** 0..1 share of one stroke that is drawn when the whole drawing is at `draw` (0..1); softly eased. */
export function strokeShare(draw: number, start: number, end: number): number {
  const k = Math.min(Math.max((draw - start) / (end - start), 0), 1);
  return k * k * (3 - 2 * k) * 0.35 + k * 0.65;
}

/** CSS-style cubic-bezier easing (x1, y1, x2, y2), solved by bisection. */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): (t: number) => number {
  const at = (u: number, a: number, b: number) => 3 * a * u * (1 - u) * (1 - u) + 3 * b * u * u * (1 - u) + u * u * u;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 28; i++) {
      const mid = (lo + hi) / 2;
      if (at(mid, x1, x2) < x) lo = mid;
      else hi = mid;
    }
    return at((lo + hi) / 2, y1, y2);
  };
}

/** "The W becomes a window": photo fades into the letter, the letter grows until the photo fills the screen, then it fades to the page. */
export const WINDOW = {
  textOutMs: 320,
  photoInMs: 500,
  growMs: 1500,
  fadeMs: 500,
  photoScaleFrom: 1.15,
  maxPhotoWaitMs: 1500,
  ease: [0.76, 0, 0.24, 1] as const,
};
/** Time from the start of the hand-over until the overlay is gone. */
export const WINDOW_TOTAL_MS = WINDOW.photoInMs + WINDOW.growMs + WINDOW.fadeMs;

/** Scale of the letter at eased progress `e` (0..1): exponential, so the flight feels even. */
export function windowScale(e: number, maxScale: number): number {
  return Math.exp(Math.log(Math.max(maxScale, 1)) * Math.min(Math.max(e, 0), 1));
}
/** Scale at which the inscribed circle (radius `radiusPx`) reaches the farthest screen corner (`farthestPx` away). */
export function coverScale(farthestPx: number, radiusPx: number): number {
  return Math.max(1, (farthestPx / Math.max(radiusPx, 1)) * 1.06);
}
